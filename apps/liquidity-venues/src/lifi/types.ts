import type { Address, Hex } from "viem";

export interface LiFiQuoteParams {
  fromChain: number | string;
  toChain: number | string;
  fromToken: string;
  toToken: string;
  fromAmount: string;
  fromAddress: string;
  toAddress?: string;
  slippage?: number;
}

export interface LiFiQuoteResponse {
  action: {
    fromChainId: number;
    toChainId: number;
    fromToken: { address: Address };
    toToken: { address: Address };
    fromAmount: string;
    slippage: number;
  };
  estimate: {
    approvalAddress: Address;
    fromAmount: string;
    toAmount: string;
    toAmountMin: string;
    executionDuration: number;
  };
  tool: string;
  transactionRequest: {
    to: Address;
    data: Hex;
    value: string;
    chainId: number;
    gasLimit: string;
    gasPrice: string;
  };
}
