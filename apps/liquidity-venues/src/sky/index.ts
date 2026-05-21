import { skyConfigs } from "@morpho-blue-liquidation-bot/config";
import type { ExecutorEncoder } from "executooor-viem";
import { type Address, encodeFunctionData } from "viem";
import { readContract } from "viem/actions";

import { daiUsdsConverterAbi, mkrSkyConverterAbi } from "../abis/sky";
import type { LiquidityVenue } from "../liquidityVenue";
import type { ToConvert } from "../types";

/**
 * Sky token converter venue.
 *
 * Converts between USDS↔DAI (1:1 via `daiUsdsConverter`) and SKY↔MKR (rate-based
 * via `mkrSkyConverter`) using the Sky/Maker on-chain converter contracts.
 *
 * Unlike the SDK's `LiquidationEncoder.handleTokenSwap` (which inlined an
 * aggregator swap after the conversion and was the subject of Cantina findings
 * MORP2-44 and MORP2-37), this venue performs ONLY the on-chain conversion.
 * The downstream venue in the chain (typically 1inch) is responsible for the
 * subsequent swap to the loan token — so the audit's "conversion without swap"
 * and "swap without conversion" bug classes cannot occur by construction.
 *
 * `supportsRoute` triggers when:
 *   - dst is the direct alternative (USDS→DAI when dst is DAI, etc.), or
 *   - src is on the "wrapped" side (USDS or SKY) and dst is some third token,
 *     in which case converting to DAI/MKR opens deeper aggregator liquidity
 *     before the next venue runs.
 */
export class Sky implements LiquidityVenue {
  supportsRoute(encoder: ExecutorEncoder, src: Address, dst: Address) {
    if (src === dst) return false;
    const chainConfig = skyConfigs[encoder.client.chain.id];
    if (!chainConfig) return false;

    const srcTokenConfig = chainConfig.tokens[src];
    if (!srcTokenConfig) return false;

    return dst === srcTokenConfig.alternative || srcTokenConfig.preferAlternative;
  }

  async convert(encoder: ExecutorEncoder, toConvert: ToConvert) {
    const { src, dst, srcAmount } = toConvert;
    const chainConfig = skyConfigs[encoder.client.chain.id];
    if (!chainConfig) return toConvert;

    const srcTokenConfig = chainConfig.tokens[src];
    if (!srcTokenConfig) return toConvert;

    const outputAmount = srcTokenConfig.rate1to1
      ? srcAmount
      : await this.computeRateBasedOutput(
          encoder,
          srcTokenConfig.converter,
          srcTokenConfig.conversionFunction,
          srcAmount,
        );

    if (outputAmount === 0n) return toConvert;

    const abi =
      srcTokenConfig.conversionFunction === "usdsToDai" ||
      srcTokenConfig.conversionFunction === "daiToUsds"
        ? daiUsdsConverterAbi
        : mkrSkyConverterAbi;

    encoder.erc20Approve(src, srcTokenConfig.converter, srcAmount).pushCall(
      srcTokenConfig.converter,
      0n,
      encodeFunctionData({
        abi,
        functionName: srcTokenConfig.conversionFunction,
        args: [encoder.address, srcAmount],
      }),
    );

    return { src: srcTokenConfig.alternative, dst, srcAmount: outputAmount };
  }

  private async computeRateBasedOutput(
    encoder: ExecutorEncoder,
    converter: Address,
    fn: "skyToMkr" | "mkrToSky" | "usdsToDai" | "daiToUsds",
    srcAmount: bigint,
  ) {
    const rate = await readContract(encoder.client, {
      address: converter,
      abi: mkrSkyConverterAbi,
      functionName: "rate",
    });
    if (rate === 0n) return 0n;
    // The Maker MkrSkyConverter holds a fixed integer rate (24000 SKY = 1 MKR).
    return fn === "skyToMkr" ? srcAmount / rate : srcAmount * rate;
  }
}
