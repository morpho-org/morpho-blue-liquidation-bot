import {
  LIFI_API_BASE_URL,
  lifiSlippage,
  lifiSupportedNetworks,
} from "@morpho-blue-liquidation-bot/config";
import { ExecutorEncoder } from "executooor-viem";
import { Address } from "viem";

import { LiquidityVenue } from "../liquidityVenue";
import { ToConvert } from "../types";

import { LiFiQuoteParams, LiFiQuoteResponse } from "./types";

export class LiFi implements LiquidityVenue {
  private apiKey: string | undefined;

  constructor() {
    this.apiKey = process.env.LIFI_API_KEY;
  }

  supportsRoute(encoder: ExecutorEncoder, src: Address, dst: Address) {
    if (src === dst) return false;
    if (!lifiSupportedNetworks.includes(encoder.client.chain.id)) return false;
    return this.apiKey !== undefined;
  }

  async convert(encoder: ExecutorEncoder, toConvert: ToConvert) {
    try {
      const quote = await this.fetchQuote({
        fromChain: encoder.client.chain.id,
        toChain: encoder.client.chain.id,
        fromToken: toConvert.src,
        toToken: toConvert.dst,
        fromAmount: toConvert.srcAmount.toString(),
        fromAddress: encoder.address,
        slippage: lifiSlippage,
      });

      encoder
        .erc20Approve(toConvert.src, quote.estimate.approvalAddress, toConvert.srcAmount)
        .pushCall(
          quote.transactionRequest.to,
          BigInt(quote.transactionRequest.value),
          quote.transactionRequest.data,
        );

      /// assumed to be the last liquidity venue
      return {
        src: toConvert.dst,
        dst: toConvert.dst,
        srcAmount: 0n,
      };
    } catch (error) {
      throw new Error(
        `(lifi) Error fetching quote: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private async fetchQuote(params: LiFiQuoteParams) {
    const url = new URL(`${LIFI_API_BASE_URL}/quote`);
    Object.entries(params).forEach(([key, value]) => {
      if (value == null) return;
      url.searchParams.set(key, String(value));
    });

    const res = await fetch(url, {
      headers: {
        accept: "application/json",
        "x-lifi-api-key": this.apiKey ?? "",
      },
    });

    if (!res.ok) throw Error(`${res.status} ${res.statusText}`);

    return (await res.json()) as LiFiQuoteResponse;
  }
}
