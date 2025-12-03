import type { Address } from "viem";
import { base, unichain, katana, worldchain } from "viem/chains";

import { hyperevm, monad } from "../chains";

export const MIN_SQRT_RATIO = 4295128739n;
export const MAX_SQRT_RATIO = 1461446703485210103287273052203988822378723970342n;

export const DEFAULT_FACTORY_ADDRESS = "0x1F98431c8aD98523631AE4a59f267346ea31F984" as Address;

export const specificFactoryAddresses: Record<number, Address> = {
  [base.id]: "0x33128a8fC17869897dcE68Ed026d694621f6FDfD",
  [unichain.id]: "0x1F98400000000000000000000000000000000003",
  [katana.id]: "0x203e8740894c8955cB8950759876d7E7E45E04c1",
  [worldchain.id]: "0x7a5028BDa40e7B173C278C5342087826455ea25a",
  [hyperevm.id]: "0xB1c0fa0B789320044A6F623cFe5eBda9562602E3",
  [monad.id]: "0x204faca1764b154221e35c0d20abb3c525710498",
};

export const FEE_TIERS = [500, 3000, 10000];
