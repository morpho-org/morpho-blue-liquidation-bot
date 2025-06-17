import type { Address } from "viem";
import { base, unichain } from "viem/chains";

export const MIN_SQRT_RATIO = 4295128739n;
export const MAX_SQRT_RATIO = 1461446703485210103287273052203988822378723970342n;

export const DEFAULT_FACTORY_ADDRESS = "0x1F98431c8aD98523631AE4a59f267346ea31F984" as Address;

export const specificFactoryAddresses: Record<number, Address> = {
  [base.id]: "0x33128a8fC17869897dcE68Ed026d694621f6FDfD",
  [unichain.id]: "0x1F98400000000000000000000000000000000003",
};

export const FEE_TIERS = [500, 3000, 10000];
