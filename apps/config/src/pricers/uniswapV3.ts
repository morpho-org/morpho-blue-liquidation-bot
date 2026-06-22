import type { Address } from "viem";
import { arbitrum, base, katana, mainnet, unichain, worldchain } from "viem/chains";

import { hyperevm, monad } from "../chains";

export const USD_REFERENCE: Record<number, Address> = {
  [mainnet.id]: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
  [base.id]: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  [katana.id]: "0x203A662b0BD271A6ed5a60EdFbd04bFce608FD36",
  [hyperevm.id]: "0xb88339CB7199b77E23DB6E890353E22632Ba630f",
  [monad.id]: "0x754704Bc059F8C67012fEd69BC8A327a5aafb603",
  [arbitrum.id]: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
  [worldchain.id]: "0x79A02482A880bCE3F13e09Da970dC34db4CD24d1",
  [unichain.id]: "0x078D782b760474a361dDA0AF3839290b0EF57AD6",
};
