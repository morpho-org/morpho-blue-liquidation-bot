import type { Address } from "viem";
import { base, mainnet, arbitrum, unichain, polygon, worldchain, katana } from "viem/chains";

import { hyperevm } from "../chains";

export const USD_REFERENCE: Record<number, Address> = {
  [mainnet.id]: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
  [base.id]: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  [katana.id]: "0x203A662b0BD271A6ed5a60EdFbd04bFce608FD36",
  [arbitrum.id]: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  [unichain.id]: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  [polygon.id]: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  [worldchain.id]: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
  [hyperevm.id]: "0xb88339CB7199b77E23DB6E890353E22632Ba630f",
};
