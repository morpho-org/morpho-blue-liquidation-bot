import { arbitrum, base, katana, mainnet, unichain, worldchain } from "viem/chains";

import { hyperevm, monad } from "./chains";
import type { Config } from "./types";

/// Bad debt realization

export const ALWAYS_REALIZE_BAD_DEBT = false; // true if you want to always realize bad debt

/// Cooldown mechanisms

export const MARKETS_FETCHING_COOLDOWN_PERIOD = 60 * 60 * 24; // 24 hours (1 day)
export const POSITION_LIQUIDATION_COOLDOWN_ENABLED = true; // true if you want to enable the cooldown mechanism
export const POSITION_LIQUIDATION_COOLDOWN_PERIOD = 120; // 2 minutes

/// Chains configurations

export const chainConfigs: Record<number, Config> = {
  [mainnet.id]: {
    chain: mainnet,
    wNative: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
    options: {
      dataProvider: "morphoApi",
      vaultWhitelist: [
        "0xBEEF01735c132Ada46AA9aA4c54623cAA92A64CB",
        "0x8eB67A509616cd6A7c1B3c8C21D48FF57df3d458",
      ],
      additionalMarketsWhitelist: [
        "0x1eda1b67414336cab3914316cb58339ddaef9e43f939af1fed162a989c98bc20",
        "0xff527fe9c6516f9d82a3d51422ccb031d123266e6e26d4c22c942a948c180a75",
      ],
      liquidityVenues: [
        "pendlePT",
        "midas",
        "1inch",
        "erc20Wrapper",
        "erc4626",
        "uniswapV3",
        "uniswapV4",
      ],
      pricers: ["chainlink", "defillama", "uniswapV3"],
      liquidationBufferBps: 50,
      useFlashbots: true,
      blockInterval: 1,
    },
  },
  [base.id]: {
    chain: base,
    wNative: "0x4200000000000000000000000000000000000006",
    options: {
      dataProvider: "morphoApi",
      vaultWhitelist: ["0xbeeF010f9cb27031ad51e3333f9aF9C6B1228183"],
      additionalMarketsWhitelist: [],
      liquidityVenues: [
        "pendlePT",
        "midas",
        "1inch",
        "erc20Wrapper",
        "erc4626",
        "uniswapV3",
        "uniswapV4",
      ],
      pricers: ["chainlink", "defillama", "uniswapV3"],
      liquidationBufferBps: 50,
      useFlashbots: false,
      blockInterval: 1,
    },
  },
  [unichain.id]: {
    chain: unichain,
    wNative: "0x4200000000000000000000000000000000000006",
    options: {
      dataProvider: "morphoApi",
      vaultWhitelist: "morpho-api",
      additionalMarketsWhitelist: [],
      liquidityVenues: ["1inch", "erc20Wrapper", "erc4626", "uniswapV3", "uniswapV4"],
      liquidationBufferBps: 50,
      useFlashbots: false,
      blockInterval: 5,
    },
  },
  [katana.id]: {
    chain: katana,
    wNative: "0xEE7D8BCFb72bC1880D0Cf19822eB0A2e6577aB62",
    options: {
      dataProvider: "morphoApi",
      vaultWhitelist: "morpho-api",
      additionalMarketsWhitelist: [],
      liquidityVenues: ["erc20Wrapper", "erc4626", "uniswapV3", "uniswapV4"],
      liquidationBufferBps: 50,
      useFlashbots: false,
      blockInterval: 5,
    },
  },
  [arbitrum.id]: {
    chain: arbitrum,
    wNative: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1",
    options: {
      dataProvider: "morphoApi",
      vaultWhitelist: "morpho-api",
      additionalMarketsWhitelist: [],
      liquidityVenues: ["pendlePT", "1inch", "erc20Wrapper", "erc4626", "uniswapV3", "uniswapV4"],
      liquidationBufferBps: 50,
      useFlashbots: false,
    },
  },
  [worldchain.id]: {
    chain: worldchain,
    wNative: "0x4200000000000000000000000000000000000006",
    options: {
      dataProvider: "morphoApi",
      vaultWhitelist: [
        "0xb1E80387EbE53Ff75a89736097D34dC8D9E9045B", // Re7 USDC
        "0x348831b46876d3dF2Db98BdEc5E3B4083329Ab9f", // Re7 WLD
        "0x0Db7E405278c2674F462aC9D9eb8b8346D1c1571", // Re7 WETH
        "0xBC8C37467c5Df9D50B42294B8628c25888BECF61", // Re7 WBTC
      ],
      additionalMarketsWhitelist: [],
      liquidityVenues: ["erc20Wrapper", "erc4626", "uniswapV3", "uniswapV4"],
      liquidationBufferBps: 50,
      useFlashbots: false,
      blockInterval: 5,
    },
  },
  [hyperevm.id]: {
    chain: hyperevm,
    wNative: "0x5555555555555555555555555555555555555555",
    options: {
      dataProvider: "morphoApi",
      vaultWhitelist: [
        "0x8A862fD6c12f9ad34C9c2ff45AB2b6712e8CEa27", // Felix USDC
        "0xFc5126377F0efc0041C0969Ef9BA903Ce67d151e", // Felix USDT
        "0x2900ABd73631b2f60747e687095537B673c06A76", // Felix HYPE
      ],
      liquidityVenues: ["liquidSwap", "erc20Wrapper", "erc4626", "uniswapV3"],
      pricers: ["uniswapV3"],
      /// Markets outside the Felix vaults' withdraw queues whose collaterals are routable via
      /// LiquidSwap (LST HYPE / UBTC / UETH / sUSDe). Identified via `scripts/discover-hyperevm-markets.mjs`.
      /// Loan tokens are USDe and WHYPE — both supported by LiquidSwap, no extra venue needed.
      additionalMarketsWhitelist: [
        "0x292f0a3ddfb642fbaadf258ebcccf9e4b0048a9dc5af93036288502bde1a71b1", // WHYPE   / USDe
        "0x5fe3ac84f3a2c4e3102c3e6e9accb1ec90c30f6ee87ab1fcafc197b8addeb94c", // UBTC    / USDe
        "0xa7fe39c692f0192fb2f281a6cc16c8b2e1c8f9b9f2bc418e0c0c1e9374bf4b04", // WHYPE   / USDe
        "0x5ef35fe4418a6bcfcc70fe32efce30074f22e9a782f81d432c1e537ddbda11e2", // UBTC    / USDe
        "0x0e5172eeb1bbf076fccc101f4a47e6f2db42eb7c39e44bd015c64b5e63e3da3d", // lstHYPE / WHYPE
        "0xe9a9bb9ed3cc53f4ee9da4eea0370c2c566873d5de807e16559a99907c9ae227", // wstHYPE / WHYPE
        "0xe41ace68f2de7be8e47185b51ddc23d4a58aac4ce9f8cc5f9384fe26f2104ec8", // sUSDe   / USDe
        "0xb142d65d7c624def0a9f4b49115b83f400a86bd2904d4f3339ec4441e28483ea", // wstHYPE / USDe
        "0x964e7d1db11bdf32262c71274c297dcdb4710d73acb814f04fdca8b0c7cdf028", // UETH    / USDe
        "0x0a2e456ebd22ed68ae1d5c6b2de70bc514337ac588a7a4b0e28f546662144036", // beHYPE  / WHYPE
        "0x19e47d37453628ebf0fd18766ce6fee1b08ea46752a5da83ca0bfecb270d07e8", // hbHYPE  / WHYPE
        "0xf25db2433ae650155eae04ebd8b3795d19bfcb318d22926a8a5e746e8028e0a8", // kHYPE   / WHYPE
        "0xabb2460997195a4b8be22346e3c0ed3a4f778868a7352d130ec09554df3f147b", // kHYPE   / WHYPE
        "0xbc15a1782163f4be46c23ac61f5da50fed96ad40293f86a5ce0501ce4a246b32", // wstHYPE / WHYPE
      ],
      liquidationBufferBps: 50,
      useFlashbots: false,
      disableSimulateCalls: true,
      minLiquidationValueUsd: 1,
    },
  },
  [monad.id]: {
    chain: monad,
    wNative: "0x3bd359C1119dA7Da1D913D1C4D2B7c461115433A",
    options: {
      dataProvider: "morphoApi",
      vaultWhitelist: "morpho-api",
      additionalMarketsWhitelist: [],
      liquidityVenues: ["erc20Wrapper", "erc4626", "uniswapV3"],
      liquidationBufferBps: 50,
      useFlashbots: false,
      blockInterval: 10,
    },
  },
};
