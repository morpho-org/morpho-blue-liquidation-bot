import type { AccrualPosition, PreLiquidationPosition } from "@morpho-org/blue-sdk";
import type { Account, Address, Chain, Client, Hex, Transport } from "viem";

export interface LiquidatablePositionsResult {
  liquidatablePositions: AccrualPosition[];
  preLiquidatablePositions: PreLiquidationPosition[];
}

/**
 * Data providers are used to fetch market and position data.
 * All data providers must implement this interface.
 */
export interface DataProvider {
  /**
   * Optional async initialization (e.g. spinning up an indexer, waiting for backfill).
   * Called once before the provider is used.
   */
  init?(): Promise<void>;

  /**
   * Fetch the market IDs for the given vaults.
   */
  fetchMarkets(client: Client<Transport, Chain, Account>, vaults: Address[]): Promise<Hex[]>;

  /**
   * Fetch liquidatable and pre-liquidatable positions for the given market IDs.
   */
  fetchLiquidatablePositions(
    client: Client<Transport, Chain, Account>,
    marketIds: Hex[],
  ): Promise<LiquidatablePositionsResult>;
}
