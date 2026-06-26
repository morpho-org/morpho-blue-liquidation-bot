import type { Address } from "viem";
import { base, mainnet } from "viem/chains";

export const wrappers: Record<number, Record<Address, Address>> = {
  [mainnet.id]: {},
  [base.id]: {},
};
