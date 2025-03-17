import type { ExecutorEncoder } from "executooor-viem";
import type { ToConvert } from "../utils";

/**
 * Liquidity venues are used to convert an amount from a source token to a destination token.
 * All liquidity venues must implement this interface.
 */
export interface LiquidityVenue {
  /**
   * Whether the venue is adapted to the conversion.
   */
  isAdaptedTo(toConvert: ToConvert): boolean;

  /**
   * Convert the amount from src to dst.
   */
  convert(executor: ExecutorEncoder, toConvert: ToConvert): Promise<void>;
}
