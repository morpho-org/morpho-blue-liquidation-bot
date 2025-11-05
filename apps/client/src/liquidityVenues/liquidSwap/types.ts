export interface SwapRouteV2Response {
  success: boolean;
  tokens: {
    tokenIn: {
      address: string;
      symbol: string;
      name: string;
      decimals: number;
    };
    tokenOut: {
      address: string;
      symbol: string;
      name: string;
      decimals: number;
    };
    intermediates?: Array<{
      address: string;
      symbol: string;
      name: string;
      decimals: number;
    }>;
  };
  amountIn: string;
  amountOut: string;
  averagePriceImpact: string;
  execution: {
    to: string;
    calldata: string;
    details: {
      path: string[];
      amountIn: string;
      amountOut: string;
      minAmountOut: string;
      feeBps?: number;
      feeRecipient?: string;
      feePercentage?: string;
      hopSwaps: Array<
        Array<{
          tokenIn: string;
          tokenOut: string;
          routerIndex: number;
          routerName: string;
          fee: number;
          amountIn: string;
          amountOut: string;
          stable: boolean;
          priceImpact: string;
        }>
      >;
    };
  } | null;
}
