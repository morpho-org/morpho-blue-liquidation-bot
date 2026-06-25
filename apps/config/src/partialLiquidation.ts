import type { Address } from "viem";

/**
 * Per-chain × per-loan-asset threshold (in loan-asset atoms) that switches a
 * position into partial-liquidation mode. See the "Partial Liquidation"
 * section of the root README for full semantics.
 */
export const partialLiquidationMinBorrow: Record<number, Partial<Record<Address, bigint>>> = {};
