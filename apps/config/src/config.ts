import { base, mainnet, unichain, katana, arbitrum } from "viem/chains";

import type { Config } from "./types";

export const COOLDOWN_ENABLED = false; // true if you want to enable the cooldown mechanism
export const COOLDOWN_PERIOD = 60 * 60; // 1 hour
export const WHITELIST_FETCH_INTERVAL = 60 * 60 * 6; // 6 hours

export const chainConfigs: Record<number, Config> = {
  [mainnet.id]: {
    chain: mainnet,
    morpho: {
      address: "0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb",
      startBlock: 18883124,
    },
    adaptiveCurveIrm: {
      address: "0x870aC11D48B15DB9a138Cf899d20F13F79Ba00BC",
      startBlock: 18883124,
    },
    metaMorphoFactories: {
      addresses: [
        "0x1897A8997241C1cD4bD0698647e4EB7213535c24",
        "0xA9c3D3a366466Fa809d1Ae982Fb2c46E5fC41101",
      ],
      startBlock: 18925584,
    },
    preLiquidationFactory: {
      address: "0x6FF33615e792E35ed1026ea7cACCf42D9BF83476",
      startBlock: 21414664,
    },
    wNative: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
    options: {
      vaultWhitelist: "morpho-api",
      additionalMarketsWhitelist: [],
      checkProfit: true,
      liquidationBufferBps: 50,
    },
  },
  [base.id]: {
    chain: base,
    morpho: {
      address: "0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb",
      startBlock: 13977148,
    },
    adaptiveCurveIrm: {
      address: "0x46415998764C29aB2a25CbeA6254146D50D22687",
      startBlock: 13977152,
    },
    metaMorphoFactories: {
      addresses: [
        "0xFf62A7c278C62eD665133147129245053Bbf5918",
        "0xA9c3D3a366466Fa809d1Ae982Fb2c46E5fC41101",
      ],
      startBlock: 13978134,
    },
    preLiquidationFactory: {
      address: "0x8cd16b62E170Ee0bA83D80e1F80E6085367e2aef",
      startBlock: 23779056,
    },
    wNative: "0x4200000000000000000000000000000000000006",
    options: {
      vaultWhitelist: "morpho-api",
      additionalMarketsWhitelist: [],
      checkProfit: true,
      liquidationBufferBps: 50,
    },
  },
  [unichain.id]: {
    chain: unichain,
    morpho: { address: "0x8f5ae9CddB9f68de460C77730b018Ae7E04a140A", startBlock: 9139027 },
    adaptiveCurveIrm: {
      address: "0x9a6061d51743B31D2c3Be75D83781Fa423f53F0E",
      startBlock: 9139027,
    },
    metaMorphoFactories: {
      addresses: ["0xe9EdE3929F43a7062a007C3e8652e4ACa610Bdc0"],
      startBlock: 9316789,
    },
    preLiquidationFactory: {
      address: "0xb04e4D3D59Ee47Ca9BA192707AF13A7D02969911",
      startBlock: 9381237,
    },
    wNative: "0x4200000000000000000000000000000000000006",
    options: {
      vaultWhitelist: "morpho-api",
      additionalMarketsWhitelist: [],
      checkProfit: false,
      liquidationBufferBps: 50,
    },
  },
  [katana.id]: {
    chain: katana,
    morpho: { address: "0xD50F2DffFd62f94Ee4AEd9ca05C61d0753268aBc", startBlock: 2741069 },
    adaptiveCurveIrm: {
      address: "0x4F708C0ae7deD3d74736594C2109C2E3c065B428",
      startBlock: 2741069,
    },
    metaMorphoFactories: {
      addresses: ["0x1c8De6889acee12257899BFeAa2b7e534de32E16"],
      startBlock: 2741420,
    },
    preLiquidationFactory: {
      address: "0x678EB53A3bB79111263f47B84989d16D81c36D85",
      startBlock: 2741993,
    },
    wNative: "0xEE7D8BCFb72bC1880D0Cf19822eB0A2e6577aB62",
    options: {
      vaultWhitelist: "morpho-api",
      additionalMarketsWhitelist: [],
      checkProfit: false,
      liquidationBufferBps: 50,
    },
  },
  [arbitrum.id]: {
    chain: arbitrum,
    morpho: { address: "0x6c247b1F6182318877311737BaC0844bAa518F5e", startBlock: 296446593 },
    adaptiveCurveIrm: {
      address: "0x66F30587FB8D4206918deb78ecA7d5eBbafD06DA",
      startBlock: 296446593,
    },
    metaMorphoFactories: {
      addresses: ["0x878988f5f561081deEa117717052164ea1Ef0c82"],
      startBlock: 296446593,
    },
    preLiquidationFactory: {
      address: "0x635c31B5DF1F7EFbCbC07E302335Ef4230758e3d",
      startBlock: 307326238,
    },
    wNative: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1",
    options: {
      vaultWhitelist: "morpho-api",
      additionalMarketsWhitelist: [],
      checkProfit: false,
      liquidationBufferBps: 50,
    },
  },
};
