import { LIQUID_SWAP_SUPPORTED_NETWORKS } from "@morpho-blue-liquidation-bot/config";
import { ExecutorEncoder } from "executooor-viem";
import { Account, Address, Chain, Client, erc20Abi, Hex, parseUnits, Transport } from "viem";
import { readContract } from "viem/actions";

import { LiquidityVenue } from "../liquidityVenue";
import { ToConvert } from "../types";

import { SwapRouteV2Response } from "./types";

export class LiquidSwapVenue implements LiquidityVenue {
  private assetsDecimals: Record<number, Record<Address, number>> = {};
  private baseApiUrl = "https://api.liqd.ag/v2/route";

  supportsRoute(encoder: ExecutorEncoder, src: Address, dst: Address) {
    if (src === dst) return false;

    return LIQUID_SWAP_SUPPORTED_NETWORKS.includes(encoder.client.chain.id);
  }

  async convert(encoder: ExecutorEncoder, toConvert: ToConvert) {
    const { src, dst, srcAmount } = toConvert;

    try {
      const srcDecimals = await this.getAssetsDecimals(encoder.client, src);

      const url = this.apiUrl(src, dst, Math.floor(Number(srcAmount) / 10 ** srcDecimals));
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
      console.error("failed to fetch assets decimals or liquid swap route", error);
      return toConvert;
    }
  }

  private apiUrl(src: Address, dst: Address, amount: number) {
    return `${this.baseApiUrl}?tokenIn=${src}&tokenOut=${dst}&amountIn=${amount}`;
  }

  private async getAssetsDecimals(client: Client<Transport, Chain, Account>, asset: Address) {
    const chainId = client.chain.id;
    this.assetsDecimals[chainId] ??= {};

    const chainDecimals = this.assetsDecimals[chainId];
    if (chainDecimals[asset] === undefined) {
      chainDecimals[asset] = await readContract(client, {
        address: asset,
        abi: erc20Abi,
        functionName: "decimals",
      });
    }
    return chainDecimals[asset];
  }
}
