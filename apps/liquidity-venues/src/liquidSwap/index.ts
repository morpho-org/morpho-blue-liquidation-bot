import { LIQUID_SWAP_SUPPORTED_NETWORKS } from "@morpho-blue-liquidation-bot/config";
import { ExecutorEncoder } from "executooor-viem";
import { Address, getAddress, Hex, parseUnits } from "viem";

import { LiquidityVenue } from "../liquidityVenue";
import { ToConvert } from "../types";

import { SwapRouteV2Response } from "./types";

export class LiquidSwapVenue implements LiquidityVenue {
  private baseApiUrl = "https://api.liqd.ag/v2/route";

  supportsRoute(encoder: ExecutorEncoder, src: Address, dst: Address) {
    if (src === dst) return false;

    return LIQUID_SWAP_SUPPORTED_NETWORKS.includes(encoder.client.chain.id);
  }

  async convert(encoder: ExecutorEncoder, toConvert: ToConvert) {
    const { src, dst, srcAmount } = toConvert;

    try {
      /// amountIn must be in smallest units (wei). Using `Number(bigint)` loses precision
      /// above ~2^53 and `floor(amount / 10**d)` mis-quotes vs the actual `srcAmount` encoded on-chain.
      const url = this.apiUrl(src, dst, srcAmount);
      const response = await fetch(url);
      const data = (await response.json()) as SwapRouteV2Response;

      if (!data.success || !data.execution) {
        throw new Error("failed to fetch liquid swap route");
      }

      encoder.erc20Approve(src, data.execution.to as Address, srcAmount);
      encoder.pushCall(data.execution.to as Address, 0n, data.execution.calldata as Hex);

      return {
        src: dst,
        dst,
        srcAmount: parseUnits(data.amountOut, data.tokens.tokenOut.decimals),
      };
    } catch (error) {
      console.error("failed to fetch liquid swap route", error);
      return toConvert;
    }
  }

  private apiUrl(src: Address, dst: Address, amountInWei: bigint) {
    const tokenIn = getAddress(src);
    const tokenOut = getAddress(dst);
    return `${this.baseApiUrl}?tokenIn=${tokenIn}&tokenOut=${tokenOut}&amountIn=${amountInWei.toString()}`;
  }
}
