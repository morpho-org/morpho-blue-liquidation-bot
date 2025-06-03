import type { Account, Address, Chain, Client, MaybePromise, Transport } from "viem";

/**
 * Pricers are used to price an asset in USD.
 * All pricers must implement this interface.
 */
export interface Pricer {
  /**
   * Get the price of the asset in USD.
   */
  price(
    client: Client<Transport, Chain, Account>,
    asset: Address,
  ): MaybePromise<number | undefined>;
}
