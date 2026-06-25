import type { Address } from "viem";

/**
 * Per-chain × per-loan-asset minimum loan-asset amount (in atoms) that a
 * partial-liquidation candidate must repay to be considered.
 *
 * Semantics:
 * - A chain is "partial-liquidation enabled" if it has an entry in this map.
 *   Chains absent from this map only ever try a single full-seize attempt
 *   (the legacy behavior).
 * - For an enabled chain, a market is "partial-liquidation enabled" only if
 *   its `loanToken` appears in the chain's submap. Markets with a loan token
 *   not listed here fall back to a single full-seize attempt.
 * - For a partial-liquidation-enabled market, the bot tries candidate seize
 *   amounts `seizableCollateral / 2^i` for i in [0, 10). Each candidate's
 *   repaid loan-asset amount must be ≥ this threshold to be tried — except
 *   a full bad-debt seize (candidate equals the position's collateral), which
 *   is always tried. Among candidates that pass simulation and profitability,
 *   the one with the LARGEST seize amount is submitted.
 *
 * Values are in the loan asset's smallest unit (atoms). For USDC (6 decimals)
 * `100_000_000n` = 100 USDC; for DAI (18 decimals) `100_000_000_000_000_000_000n`
 * = 100 DAI.
 */
export const partialLiquidationMinRepay: Record<number, Partial<Record<Address, bigint>>> = {};
