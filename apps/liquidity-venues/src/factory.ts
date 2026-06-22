import type { LiquidityVenueName } from "@morpho-blue-liquidation-bot/config";

import { OneInch } from "./1inch";
import { Erc20Wrapper } from "./erc20Wrapper";
import { Erc4626 } from "./erc4626";
import { LiquidityVenue } from "./liquidityVenue";
import { LiquidSwapVenue } from "./liquidSwap";
import { MidasVenue } from "./midas";
import { PendlePTVenue } from "./pendlePT";
import { UniswapV3Venue } from "./uniswapV3";
import { UniswapV4Venue } from "./uniswapV4";

/**
 * Creates a liquidity venue instance based on the liquidity venue name from config.
 * This factory function avoids circular dependencies by keeping liquidity venue
 * class imports in the client package, while config only exports string identifiers.
 */
export function createLiquidityVenue(liquidityVenueName: LiquidityVenueName): LiquidityVenue {
  switch (liquidityVenueName) {
    case "erc20Wrapper":
      return new Erc20Wrapper();
    case "erc4626":
      return new Erc4626();
    case "uniswapV3":
      return new UniswapV3Venue();
    case "uniswapV4":
      return new UniswapV4Venue();
    case "liquidSwap":
      return new LiquidSwapVenue();
    case "midas":
      return new MidasVenue();
    case "pendlePT":
      return new PendlePTVenue();
    case "1inch":
      return new OneInch();
    default:
      throw new Error(`Unknown liquidity venue: ${liquidityVenueName}`);
  }
}
