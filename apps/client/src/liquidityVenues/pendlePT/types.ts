import { Address, Hex } from "viem";

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

export interface PendleMarket {
  name: string;
  address: string;
  expiry: string;
  pt: string;
  yt: string;
  sy: string;
  underlyingAsset: string;
  details: {
    liquidity: number;
    pendleApy: number;
    impliedApy: number;
    feeRate: number;
    yieldRange: {
      min: number;
      max: number;
    };
    aggregatedApy: number;
    maxBoostedApy: number;
  };
  isNew: boolean;
  isPrime: boolean;
  timestamp: string;
  categoryIds: string[];
  chainId: number;
}

export interface PendleMarketsResponse {
  markets: PendleMarket[];
}
