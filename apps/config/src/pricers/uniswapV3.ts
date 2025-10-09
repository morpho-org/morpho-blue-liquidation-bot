import type { Address } from "viem";
import { base, mainnet, katana, arbitrum, unichain } from "viem/chains";

export const USD_REFERENCE: Record<number, Address> = {
  [mainnet.id]: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
  [base.id]: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  [katana.id]: "0x203A662b0BD271A6ed5a60EdFbd04bFce608FD36",
  [arbitrum.id]: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
  [unichain.id]: "0x078D782b760474a361dDA0AF3839290b0EF57AD6",
};
