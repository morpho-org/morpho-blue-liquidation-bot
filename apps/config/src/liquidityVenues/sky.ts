import type { Address } from "viem";
import { mainnet } from "viem/chains";

export type SkyConversion = "usdsToDai" | "daiToUsds" | "skyToMkr" | "mkrToSky";

export interface SkyTokenConfig {
  alternative: Address;
  converter: Address;
  conversionFunction: SkyConversion;
  /**
   * Whether the conversion ratio is 1:1 (USDS↔DAI). When false (SKY↔MKR), the
   * venue must read `rate()` from the converter at runtime to size the output.
   */
  rate1to1: boolean;
  /**
   * If true and `dst` is not the direct alternative, the venue still converts
   * (towards the alternative) on the assumption that the alternative token has
   * deeper downstream aggregator liquidity. Set on the "wrapped" side of each
   * pair (USDS, SKY).
   */
  preferAlternative: boolean;
}

export interface SkyChainConfig {
  tokens: Record<Address, SkyTokenConfig>;
}

const USDS = "0xdC035D45d973E3EC169d2276DDab16f1e407384F" as Address;
const DAI = "0x6B175474E89094C44Da98b954EedeAC495271d0F" as Address;
const SKY = "0x56072C95FAA701256059aa122697B133aDEd9279" as Address;
const MKR = "0x9f8F72aA9304c8B593d555F12eF6589cC3A579A2" as Address;

const DAI_USDS_CONVERTER = "0x3225737a9Bbb6473CB4a45b7244ACa2BeFdB276A" as Address;
const MKR_SKY_CONVERTER = "0xBDcFCA946b6CDd965f99a839e4435Bcdc1bc470B" as Address;

export const skyConfigs: Record<number, SkyChainConfig | undefined> = {
  [mainnet.id]: {
    tokens: {
      [USDS]: {
        alternative: DAI,
        converter: DAI_USDS_CONVERTER,
        conversionFunction: "usdsToDai",
        rate1to1: true,
        preferAlternative: true,
      },
      [DAI]: {
        alternative: USDS,
        converter: DAI_USDS_CONVERTER,
        conversionFunction: "daiToUsds",
        rate1to1: true,
        preferAlternative: false,
      },
      [SKY]: {
        alternative: MKR,
        converter: MKR_SKY_CONVERTER,
        conversionFunction: "skyToMkr",
        rate1to1: false,
        preferAlternative: true,
      },
      [MKR]: {
        alternative: SKY,
        converter: MKR_SKY_CONVERTER,
        conversionFunction: "mkrToSky",
        rate1to1: false,
        preferAlternative: false,
      },
    },
  },
};
