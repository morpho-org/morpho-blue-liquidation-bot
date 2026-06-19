import type { BigIntish } from "@morpho-org/blue-sdk";
import type { Address, Hex } from "viem";

export interface ZeroExSwapParams {
  chainId: BigIntish;
  sellToken: string;
  buyToken: string;
  sellAmount: BigIntish;
  taker: string;
  txOrigin?: string;
  slippageBps?: BigIntish;
}

export interface ZeroExSwapResponse {
  liquidityAvailable: boolean;
  sellAmount: string;
  buyAmount: string;
  minBuyAmount: string;
  issues?: {
    allowance?: {
      actual: string;
      spender: Address;
    } | null;
    balance?: {
      token: Address;
      actual: string;
      expected: string;
    } | null;
    simulationIncomplete?: boolean;
    invalidSourcesPassed?: string[];
  };
  transaction: {
    to: Address;
    data: Hex;
    value: string;
    gas: string;
    gasPrice: string;
  };
}
