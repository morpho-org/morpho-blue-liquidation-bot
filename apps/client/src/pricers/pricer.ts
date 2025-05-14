import type { Account, Address, Chain, Client, MaybePromise, Transport } from "viem";

/**
 * Pricers are used to convert an amount from a source token to a destination token.
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
