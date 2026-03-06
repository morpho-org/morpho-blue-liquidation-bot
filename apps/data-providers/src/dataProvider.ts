import type { AccrualPosition } from "@morpho-org/blue-sdk";
import type { Account, Address, Chain, Client, Hex, Transport } from "viem";

/**
 * Data providers are used to fetch market and position data.
 * All data providers must implement this interface.
 */
export interface DataProvider {
  /**
   * Fetch the market IDs for the given vaults.
   */
  fetchMarkets(client: Client<Transport, Chain, Account>, vaults: Address[]): Promise<Hex[]>;

  /**
   * Fetch the liquidatable positions for the given market IDs.
   */
  fetchLiquidatablePositions(
    client: Client<Transport, Chain, Account>,
    marketIds: Hex[],
  ): Promise<AccrualPosition[]>;
}
