import type { Address } from "viem";
import { arbitrum, base, katana, mainnet, polygon, unichain } from "viem/chains";

export const wrappers: Record<number, Record<Address, Address>> = {
  [mainnet.id]: {},
  [base.id]: {},
  [katana.id]: {},
  [arbitrum.id]: {},
  [unichain.id]: {},
  [polygon.id]: {},
};
