import type { Address } from "viem";

import { robinhoodChain } from "./chains";

/**
 * Per-chain × per-loan-asset threshold (in loan-asset atoms) that switches a
 * position into partial-liquidation mode. See the "Partial Liquidation"
 * section of the root README for full semantics.
 */
export const partialLiquidationMinBorrow: Record<number, Partial<Record<Address, bigint>>> = {
  [robinhoodChain.id]: {
    // USDG (6 decimals) — partialise positions borrowing ≥ 1,000 USDG. Tune as
    // liquidity / risk appetite evolves.
    "0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168": 1_000_000_000n,
  },
};
