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
      // (app.api.morpho.org) with an API key for both the data provider and
      // the listed-vaults lookup.
      dataProvider: "appMorphoApi",
      // Vault-based discovery is disabled: the one live vault on this chain
      // (Steakhouse USDG, 0xBeEff033…09dd) is a Vault V2, which the bot's
      // current V1 withdrawQueue path can't enumerate. See follow-up issue.
      // Meanwhile, watch that vault's USDG-borrow markets directly.
      vaultWhitelist: [],
      additionalMarketsWhitelist: [
        "0x919a9b6b94dae7c86620eaf7a08e597aae8a4c3a9e9c7671771fbaf62b6b61c7", // USDG / syrupUSDG
        "0xc845da65a020ddca5f132efa8fea79676d8edfdea504226a4c01e7a9e34cddd6", // USDG / USDe
        "0x0309c02dabf0be02682af1a2bde9a457f4df0f0b6bc889cde3f948e5315e4114", // USDG / spUSDG
      ],
      liquidityVenues: ["zeroEx", "uniswapV3", "uniswapV4", "erc20Wrapper", "erc4626"],
      useFlashbots: false,
      useTenderly: false,
    },
  },
};
