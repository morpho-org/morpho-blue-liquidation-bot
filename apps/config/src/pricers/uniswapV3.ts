import type { Address } from "viem";
import { base, mainnet } from "viem/chains";

export const USD_REFERENCE: Record<number, Address> = {
  [mainnet.id]: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
  [base.id]: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
};
