import type { Client, MaybePromise } from "viem";

import type { Asset } from "../utils/types";

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
  toUsd(client: Client, asset: Asset, amount: bigint): MaybePromise<number | undefined>;
}
