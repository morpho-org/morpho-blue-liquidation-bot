import type { Address } from "viem";

/**
 * Per-chain × per-loan-asset minimum borrow-assets threshold (in loan-asset atoms)
 * that switches a position into partial-liquidation mode.
 *
 * Semantics:
 * - A chain absent from this map: partial liquidation is disabled for that chain;
 *   every liquidatable position is attempted as a single full seize (legacy).
 * - A chain present but a loan asset absent from its submap: positions in markets
 *   with that loan asset are also attempted as a single full seize.
 * - A chain present AND the market's `loanToken` listed:
 *   - If `position.borrowAssets < threshold` → single full-seize attempt
 *     (regardless of bad-debt status — small positions are never partialised).
 *   - If `position.borrowAssets >= threshold` → partial mode: the bot simulates
 *     candidate seize amounts `seizableCollateral / 2^i` for i in [0, 10) and
 *     submits the candidate with the LARGEST seize amount among the simulations
 *     that pass the profitability check.
 *
 * Values are in the loan asset's smallest unit (atoms). For USDC (6 decimals)
 * `100_000_000n` = 100 USDC; for DAI (18 decimals) `100_000_000_000_000_000_000n`
 * = 100 DAI.
 */
export const partialLiquidationMinRepay: Record<number, Partial<Record<Address, bigint>>> = {};
