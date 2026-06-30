import { robinhoodChain } from "./chains";
import type { Config } from "./types";

/// Bad debt realization
export const ALWAYS_REALIZE_BAD_DEBT = true; // true if you want to always realize bad debt

/// Cooldown mechanisms

export const MARKETS_FETCHING_COOLDOWN_PERIOD = 60 * 60 * 24; // 24 hours (1 day)
export const POSITION_LIQUIDATION_COOLDOWN_ENABLED = true; // true if you want to enable the cooldown mechanism
export const POSITION_LIQUIDATION_COOLDOWN_PERIOD = 60 * 60; // 1 hour

/// Chains configurations

export const chainConfigs: Record<number, Config> = {
  [robinhoodChain.id]: {
    chain: robinhoodChain,
    wNative: "0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73",
    options: {
      // Chain is not on the public blue-api yet; use the app-API instance
      // (app.api.morpho.org) with an API key.
      dataProvider: "appMorphoApi",
      vaultWhitelist: [],
      additionalMarketsWhitelist: [],
      liquidityVenues: ["lifi", "zeroEx", "erc20Wrapper", "erc4626"],
      useFlashbots: false,
      useTenderly: false,
    },
  },
};
