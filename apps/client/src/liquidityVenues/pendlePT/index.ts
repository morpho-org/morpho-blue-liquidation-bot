import { type ExecutorEncoder } from "executooor-viem";
import { type Address, Hex, maxUint256 } from "viem";

import type { ToConvert } from "../../utils/types";
import type { LiquidityVenue } from "../liquidityVenue";
import { BigIntish } from "@morpho-org/blue-sdk";
import { API_REFRESH_INTERVAL } from "@morpho-blue-liquidation-bot/config";

export class PendlePTVenue implements LiquidityVenue {
  private API_URL = "https://api-v2.pendle.finance/core/";
  private pendleTokens: Record<number, TokenListResponse | undefined> = {};
  private lastPoolRefresh: Record<number, number | undefined> = {};

  async supportsRoute(encoder: ExecutorEncoder, src: Address, dst: Address) {
    if (src === dst) return false;

    let pendleTokens = this.pendleTokens[encoder.client.chain.id];
    let lastPoolRefresh = this.lastPoolRefresh[encoder.client.chain.id];

    if (this.pendleTokens[encoder.client.chain.id] === undefined) {
      if (lastPoolRefresh === undefined || Date.now() - lastPoolRefresh > API_REFRESH_INTERVAL) {
        try {
          pendleTokens = await this.getTokens(encoder.client.chain.id);
          lastPoolRefresh = Date.now();
        } catch (error) {
          console.error("Error fetching pendle tokens", error);
          lastPoolRefresh = Date.now(); // prevent infinite retries
          return false;
        }
      }
      return false;
    }

    return this.isPT(src, encoder.client.chain.id);
  }

  async convert(encoder: ExecutorEncoder, toConvert: ToConvert) {
    const { src, dst, srcAmount } = toConvert;

    const pendleMarketResponse = await this.getMarketForPTToken(
      encoder.client.chain.id,
      toConvert.src,
    );
    if (pendleMarketResponse.total !== 1) {
      throw Error("Invalid Pendle market result");
    }
    const pendleMarketData = pendleMarketResponse.results[0]!;
    const maturity = pendleMarketData.pt.expiry!;
    if (!maturity) {
      throw Error("Pendle market not found");
    }

    const underlyingToken = pendleMarketData.underlyingAsset.address;

    if (new Date(maturity) < new Date()) {
      // Pendle market is expired, we can directly redeem the collateral
      // If called before YT's expiry, both PT & YT of equal amounts are needed and will be burned. Else, only PT is needed and will be burned.
      const redeemCallData = await this.getRedeemCallData(encoder.client.chain.id, {
        receiver: encoder.address,
        slippage: 0.04,
        yt: pendleMarketData.yt.address,
        amountIn: srcAmount.toString(),
        tokenOut: pendleMarketData.underlyingAsset.address,
        enableAggregator: true,
      });

      encoder
        .erc20Approve(src, redeemCallData.tx.to, maxUint256)
        .pushCall(
          redeemCallData.tx.to,
          redeemCallData.tx.value ? BigInt(redeemCallData.tx.value) : 0n,
          redeemCallData.tx.data,
        );

      return { src: underlyingToken, dst, srcAmount: BigInt(redeemCallData.data.amountOut) };
    } else {
      // Pendle market is not expired, we need to swap the collateral token (PT) to the underlying token
      const swapCallData = await this.getSwapCallData(
        encoder.client.chain.id,
        pendleMarketData.address,
        {
          receiver: encoder.address,
          slippage: 0.04,
          tokenIn: src,
          tokenOut: pendleMarketData.underlyingAsset.address,
          amountIn: srcAmount.toString(),
        },
      );
      encoder
        .erc20Approve(src, swapCallData.tx.to, maxUint256)
        .pushCall(
          swapCallData.tx.to,
          swapCallData.tx.value ? BigInt(swapCallData.tx.value) : 0n,
          swapCallData.tx.data,
        );
      return { src: underlyingToken, dst, srcAmount: BigInt(swapCallData.data.amountOut) };
    }
  }

  private async getApiData<T extends {}, U>(
    chainId: number,
    endpoint: string,
    params: T,
    api: "sdk" | "non-sdk" = "sdk",
  ) {
    const queryParams = new URLSearchParams(
      Object.entries(params).map(([key, value]) => [key, String(value)]) as [string, string][],
    ).toString();

    const apiPath = api === "sdk" ? `v1/sdk/${chainId}` : `v1/${chainId}`;
    const url = `${this.API_URL}${apiPath}${endpoint}?${queryParams}`;

    const res = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
    });

    if (!res.ok) throw new Error(res.statusText);

    return res.json() as Promise<U>;
  }

  private async getSwapCallData(chainId: number, marketAddress: string, params: SwapParams) {
    return this.getApiData<SwapParams, SwapCallData>(
      chainId,
      `/markets/${marketAddress}/swap`,
      params,
    );
  }

  private async getRedeemCallData(chainId: number, params: RedeemParams) {
    return this.getApiData<RedeemParams, SwapCallData>(chainId, "/redeem", params);
  }

  private async getTokens(chainId: number) {
    return this.getApiData<{}, TokenListResponse>(
      chainId,
      "/assets/pendle-token/list",
      {},
      "non-sdk",
    );
  }

  private async getMarketForPTToken(chainId: number, token: string) {
    return this.getApiData<{}, MarketData>(chainId, `/markets?pt=${token}`, {}, "non-sdk");
  }

  private isPT(token: string, chainId: BigIntish) {
    return this.pendleTokens[Number(chainId)]!.tokens.some(
      (tokenInfo) => tokenInfo.address === token && chainId === tokenInfo.chainId,
    );
  }
}

export interface Market {
  maturity: Date;
  address: Address;
  underlyingTokenAddress: Address;
  yieldTokenAddress: Address;
}

export interface SwapParams {
  receiver: string;
  slippage: number;
  tokenIn: string;
  tokenOut: string;
  amountIn: string;
}

export interface RedeemParams {
  receiver: string;
  slippage: number;
  yt: string;
  amountIn: string;
  tokenOut: string;
  enableAggregator: boolean;
}

export interface SwapCallData {
  tx: {
    data: Hex;
    to: Address;
    value: string;
  };
  data: {
    amountOut: string;
    priceImpact: number;
  };
}

export interface VersionResponse {
  major: number;
  minor: number;
  patch: number;
}

export interface TokenInfoResponse {
  chainId: number;
  address: string;
  decimals: number;
  name: string;
  symbol: string;
  logoURI: string;
  tags: string[];
}

export interface TagDefinitionResponse {
  name: string;
  description: string;
}

export interface TokenListResponse {
  name: string;
  timestamp: string;
  version: VersionResponse;
  tokens: TokenInfoResponse[];
  tokenMap: {
    [key: string]: TokenInfoResponse;
  };
  keywords: string[];
  logoURI: string;
  tags: {
    [key: string]: TagDefinitionResponse;
  };
}

export interface MarketData {
  total: number;
  limit: number;
  skip: number;
  results: MarketResult[];
}

export interface MarketResult {
  id: string;
  chainId: number;
  address: string;
  symbol: string;
  expiry: string;
  pt: Token;
  yt: Token;
  sy: Token;
  lp: Token;
  accountingAsset: Asset;
  underlyingAsset: Asset;
  basePricingAsset: Asset;
  protocol: string;
  underlyingPool: string;
  proSymbol: string;
  proIcon: string;
  assetRepresentation: string;
  isWhitelistedPro: boolean;
  isWhitelistedSimple: boolean;
  votable: boolean;
  isActive: boolean;
  isWhitelistedLimitOrder: boolean;
  accentColor: string;
  totalPt: number;
  totalSy: number;
  totalLp: number;
  liquidity: {
    usd: number;
    acc: number;
  };
  tradingVolume: {
    usd: number;
  };
  underlyingInterestApy: number;
  underlyingRewardApy: number;
  underlyingApy: number;
  impliedApy: number;
  ytFloatingApy: number;
  ptDiscount: number;
  swapFeeApy: number;
  pendleApy: number;
  arbApy: number;
  aggregatedApy: number;
  maxBoostedApy: number;
  lpRewardApy: number;
  voterApy: number;
  ytRoi: number;
  ptRoi: number;
  dataUpdatedAt: string;
  categoryIds: string[];
  timestamp: string;
  scalarRoot: number;
  initialAnchor: number;
  extendedInfo: ExtendedInfo;
  isFeatured: boolean;
  isPopular: boolean;
  tvlThresholdTimestamp: string;
  isNew: boolean;
  name: string;
  simpleName: string;
  simpleSymbol: string;
  simpleIcon: string;
  proName: string;
  farmName: string;
  farmSymbol: string;
  farmSimpleName: string;
  farmSimpleSymbol: string;
  farmSimpleIcon: string;
  farmProName: string;
  farmProSymbol: string;
  farmProIcon: string;
}

export interface Token {
  id: string;
  chainId: number;
  address: string;
  symbol: string;
  decimals: number;
  expiry: string | null;
  accentColor: string;
  price: {
    usd: number;
    acc?: number;
  };
  priceUpdatedAt: string;
  name: string;
  baseType: string;
  types: string[];
  protocol?: string;
  underlyingPool?: string;
  proSymbol: string;
  proIcon: string;
  zappable: boolean;
  simpleName: string;
  simpleSymbol: string;
  simpleIcon: string;
  proName: string;
}

export interface Asset {
  id: string;
  chainId: number;
  address: Address;
  symbol: string;
  decimals: number;
  expiry: string | null;
  accentColor: string | null;
  price: {
    usd: number;
  };
  priceUpdatedAt: string;
  name: string;
  baseType: string;
  types: string[];
  protocol: string | null;
  proSymbol: string;
  proIcon: string;
  zappable: boolean;
  simpleName: string;
  simpleSymbol: string;
  simpleIcon: string;
  proName: string;
}

export interface ExtendedInfo {
  floatingPt: number;
  floatingSy: number;
  pyUnit: string;
  ptEqualsPyUnit: boolean;
  underlyingAssetWorthMore?: string;
  nativeWithdrawalURL?: string;
  movement10Percent: {
    ptMovementUpUsd: number;
    ptMovementDownUsd: number;
    ytMovementUpUsd: number;
    ytMovementDownUsd: number;
  };
  feeRate: number;
  yieldRange: {
    min: number;
    max: number;
  };
  sySupplyCap?: number;
  syCurrentSupply?: number;
}
