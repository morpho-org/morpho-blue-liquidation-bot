import type { Address } from "viem";
import { arbitrum, base, katana, mainnet, unichain, worldchain } from "viem/chains";

import { hyperevm, monad } from "../chains";

export const wrappers: Record<number, Record<Address, Address>> = {
  [mainnet.id]: {},
  [base.id]: {},
  [arbitrum.id]: {},
  [katana.id]: {},
  [monad.id]: {},
  [unichain.id]: {},
  [worldchain.id]: {},
  [hyperevm.id]: {},
};
