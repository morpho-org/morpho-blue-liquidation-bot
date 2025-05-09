import type { Address, Client, MaybePromise } from "viem";

/**
 * Pricers are used to convert an amount from a source token to a destination token.
 * All pricers must implement this interface.
 */
export interface Pricer {
  /**
   * Check if the pricer supports the chain.
   */
  supportsChain(chainId: number): MaybePromise<boolean>;
  /**
   * Convert the amount from src to dst.
   */
  price(client: Client, chainId: number, asset: Address): MaybePromise<number | undefined>;
}
