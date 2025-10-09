import { API_BASE_URL, slippage, supportedNetworks } from "@morpho-blue-liquidation-bot/config";
import { ExecutorEncoder } from "executooor-viem";
import { LiquidityVenue } from "../liquidityVenue";
import { Address } from "viem";
import { ToConvert } from "../../utils/types";
import { BigIntish } from "@morpho-org/blue-sdk";
import { SwapParams, SwapResponse } from "./types";

export class OneInch implements LiquidityVenue {
  private apiKey: string | undefined;

  constructor(apiKey: string | undefined) {
    this.apiKey = apiKey;
  }

  supportsRoute(encoder: ExecutorEncoder, src: Address, dst: Address) {
    if (src === dst) return false;
    if (!supportedNetworks.includes(encoder.client.chain.id)) return false;
    return this.apiKey !== undefined;
  }

  async convert(encoder: ExecutorEncoder, toConvert: ToConvert) {
    try {
      const swapResponse = await this.fetchSwap({
        chainId: encoder.client.chain.id,
        src: toConvert.src,
        dst: toConvert.dst,
        amount: toConvert.srcAmount,
        from: encoder.address,
        slippage,
        origin: encoder.client.account.address,
        includeTokensInfo: false,
        includeProtocols: false,
        includeGas: false,
        allowPartialFill: false,
        disableEstimate: true,
        usePermit2: false,
      });

      encoder
        .erc20Approve(toConvert.src, swapResponse.tx.to, toConvert.srcAmount)
        .pushCall(swapResponse.tx.to, BigInt(swapResponse.tx.value), swapResponse.tx.data);

      /// assumed to be the last liquidity venue
      return {
        src: toConvert.dst,
        dst: toConvert.dst,
        srcAmount: 0n,
      };
    } catch (error) {
      console.log(`Error swapping ${toConvert.src} to ${toConvert.dst} on 1inch`);
      console.error(error);
      return toConvert;
    }
  }

  private getSwapApiPath = (chainId: BigIntish) => `/swap/v6.0/${chainId}/swap`;

  private async fetchSwap(swapParams: SwapParams) {
    const url = new URL(this.getSwapApiPath(swapParams.chainId), API_BASE_URL);
    Object.entries(swapParams).forEach(([key, value]) => {
      if (value == null) return;
      switch (key) {
        case "slippage":
          // 1inch expects slippage as a percentage, so we divide our value (in basis points) by 100
          url.searchParams.set(key, (Number(value) / 100).toString(10));
          break;
        default:
          url.searchParams.set(key, value);
      }
    });

    const res = await fetch(url, {
      headers: {
        accept: "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
    });

    if (!res.ok) throw Error(res.statusText);

    return (await res.json()) as SwapResponse;
  }
}
