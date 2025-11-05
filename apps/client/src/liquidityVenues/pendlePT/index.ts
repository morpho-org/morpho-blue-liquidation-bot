import { type ExecutorEncoder } from "executooor-viem";
import { type Address, getAddress, maxUint256 } from "viem";

import type { ToConvert } from "../../utils/types";
import type { LiquidityVenue } from "../liquidityVenue";
import { BigIntish } from "@morpho-org/blue-sdk";
import { API_REFRESH_INTERVAL } from "@morpho-blue-liquidation-bot/config";
import {
  PendleMarket,
  PendleMarketsResponse,
  RedeemParams,
  SwapCallData,
  SwapParams,
} from "./types";

const API_URL = "https://api-v2.pendle.finance/core/";

async function getApiData<T extends {}, U>(
  chainId: number,
  endpoint: string,
  params: T,
  api: "sdk" | "non-sdk" = "sdk",
) {
  const queryParams = new URLSearchParams(
    Object.entries(params).map(([key, value]) => [key, String(value)]) as [string, string][],
  ).toString();

  const apiPath = api === "sdk" ? `v2/sdk/${chainId}` : `v2/${chainId}`;
  const url = `${API_URL}${apiPath}${endpoint}?${queryParams}`;

  const res = await fetch(url, {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
  });

  if (!res.ok) throw new Error(res.statusText);

  return res.json() as Promise<U>;
}

async function getMarkets(chainId: number) {
  const url = `${API_URL}v1/markets/all?chainId=${chainId}`;

  const res = await fetch(url, {
    method: "GET",
    headers: {
      accept: "application/json",
    },
  });

  if (!res.ok) throw new Error(res.statusText);

  return res.json() as Promise<PendleMarketsResponse>;
}

async function getSwapCallData(chainId: number, marketAddress: string, params: SwapParams) {
  return getApiData<SwapParams, SwapCallData>(chainId, `/markets/${marketAddress}/swap`, params);
}

async function getRedeemCallData(chainId: number, params: RedeemParams) {
  return getApiData<RedeemParams, SwapCallData>(chainId, "/redeem", params);
}

export class PendlePTVenue implements LiquidityVenue {
  private pendleMarkets: Record<number, PendleMarketsResponse | undefined> = {};
  private lastPoolRefresh: Record<number, number | undefined> = {};

  async supportsRoute(encoder: ExecutorEncoder, src: Address, dst: Address) {
    if (src === dst) return false;

    if (
      this.pendleMarkets[encoder.client.chain.id] === undefined ||
      this.lastPoolRefresh[encoder.client.chain.id] === undefined ||
      Date.now() - this.lastPoolRefresh[encoder.client.chain.id]! > API_REFRESH_INTERVAL
    ) {
      try {
        this.pendleMarkets[encoder.client.chain.id] = await getMarkets(encoder.client.chain.id);
        this.lastPoolRefresh[encoder.client.chain.id] = Date.now();
      } catch (error) {
        console.error("Error fetching pendle tokens", error);
        this.lastPoolRefresh[encoder.client.chain.id] = Date.now(); // prevent infinite retries
        return false;
      }
    }
    return this.isPT(src, encoder.client.chain.id);
  }

  async convert(encoder: ExecutorEncoder, toConvert: ToConvert) {
    const { src, dst, srcAmount } = toConvert;

    const pendleMarket = this.pendleMarkets[encoder.client.chain.id]!.markets.find((marketInfo) => {
      const ptAddress = marketInfo.pt.split("-")[1];
      return ptAddress === src.toLowerCase();
    });
    if (pendleMarket === undefined) {
      throw Error("Invalid Pendle market result");
    }
    const maturity = pendleMarket.expiry;
    if (!maturity) {
      throw Error("Pendle market not found");
    }

    const underlyingToken = pendleMarket.underlyingAsset.split("-")[1]!;
    let amountOut = 0n;

    if (new Date(maturity) < new Date()) {
      // Pendle market is expired, we can directly redeem the collateral
      // If called before YT's expiry, both PT & YT of equal amounts are needed and will be burned. Else, only PT is needed and will be burned.
      try {
        amountOut = await this.redeemPToUnderlying(
          encoder,
          pendleMarket,
          srcAmount,
          src,
          underlyingToken,
        );
      } catch (error) {
        console.error("Error redeeming PT to underlying", error);
        return toConvert;
      }
    } else {
      // Pendle market is not expired, we need to swap the collateral token (PT) to the underlying token
      try {
        amountOut = await this.swapPTToUnderlying(
          encoder,
          pendleMarket,
          srcAmount,
          src,
          underlyingToken,
        );
      } catch (error) {
        console.error("Error swapping PT to underlying", error);
        return toConvert;
      }
    }

    return {
      src: getAddress(underlyingToken),
      dst,
      srcAmount: amountOut,
    };
  }

  private async redeemPToUnderlying(
    encoder: ExecutorEncoder,
    pendleMarket: PendleMarket,
    srcAmount: bigint,
    src: Address,
    underlyingToken: string,
  ) {
    const redeemCallData = await getRedeemCallData(encoder.client.chain.id, {
      receiver: encoder.address,
      slippage: 0.04,
      yt: pendleMarket.yt.split("-")[1]!,
      amountIn: srcAmount.toString(),
      tokenOut: underlyingToken,
      enableAggregator: true,
    });

    encoder
      .erc20Approve(src, redeemCallData.tx.to, maxUint256)
      .pushCall(
        redeemCallData.tx.to,
        redeemCallData.tx.value ? BigInt(redeemCallData.tx.value) : 0n,
        redeemCallData.tx.data,
      );

    return BigInt(redeemCallData.data.amountOut);
  }

  private async swapPTToUnderlying(
    encoder: ExecutorEncoder,
    pendleMarket: PendleMarket,
    srcAmount: bigint,
    src: Address,
    underlyingToken: string,
  ) {
    const swapCallData = await getSwapCallData(encoder.client.chain.id, pendleMarket.address, {
      receiver: encoder.address,
      slippage: 0.04,
      tokenIn: src.toLowerCase(),
      tokenOut: underlyingToken,
      amountIn: srcAmount.toString(),
    });
    encoder
      .erc20Approve(src, swapCallData.tx.to, maxUint256)
      .pushCall(
        swapCallData.tx.to,
        swapCallData.tx.value ? BigInt(swapCallData.tx.value) : 0n,
        swapCallData.tx.data,
      );

    return BigInt(swapCallData.data.amountOut);
  }

  private isPT(token: string, chainId: BigIntish) {
    return this.pendleMarkets[Number(chainId)]!.markets.some((marketInfo) => {
      const ptAddress = marketInfo.pt.split("-")[1];
      return ptAddress === token.toLowerCase();
    });
  }
}
