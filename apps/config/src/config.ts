import { base, mainnet, unichain, katana, arbitrum } from "viem/chains";

import { hyperevm } from "./chains";
import type { Config } from "./types";

export const COOLDOWN_ENABLED = false; // true if you want to enable the cooldown mechanism
export const COOLDOWN_PERIOD = 60 * 60; // 1 hour
export const WHITELIST_FETCH_INTERVAL = 60 * 60 * 6; // 6 hours
export const ALWAYS_REALIZE_BAD_DEBT = true; // true if you want to always realize bad debt

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
      useFlashbots: true,
      blockInterval: 2,
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
      useFlashbots: false,
      blockInterval: 10,
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
      useFlashbots: false,
      blockInterval: 5,
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
      useFlashbots: false,
      blockInterval: 5,
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
      useFlashbots: false,
    },
  },
  /* [worldchain.id]: {
    chain: worldchain,
    morpho: { address: "0xE741BC7c34758b4caE05062794E8Ae24978AF432", startBlock: 9025669 },
    adaptiveCurveIrm: {
      address: "0x937Ce2d6c488b361825D2DB5e8A70e26d48afEd5",
      startBlock: 9025669,
    },
    metaMorphoFactories: {
      addresses: ["0x937Ce2d6c488b361825D2DB5e8A70e26d48afEd5"],
      startBlock: 9025733,
    },
    preLiquidationFactory: {
      address: "0xe3cE2051a24e58DBFC0eFBe4c2d9e89c5eAe4695",
      startBlock: 10273494,
    },
    wNative: "0x4200000000000000000000000000000000000006",
    options: {
      vaultWhitelist: [
        "0xb1E80387EbE53Ff75a89736097D34dC8D9E9045B", // Re7 USDC
        "0x348831b46876d3dF2Db98BdEc5E3B4083329Ab9f", // Re7 WLD
        "0xBC8C37467c5Df9D50B42294B8628c25888BECF61", // Re7 WETH
        "0xBC8C37467c5Df9D50B42294B8628c25888BECF61", // Re7 WBTC
      ],
      additionalMarketsWhitelist: [],
      checkProfit: false,
      useFlashbots: false,
      blockInterval: 5,
    },
  }, */
  [hyperevm.id]: {
    chain: hyperevm,
    morpho: { address: "0x68e37dE8d93d3496ae143F2E900490f6280C57cD", startBlock: 1988429 },
    adaptiveCurveIrm: {
      address: "0xD4a426F010986dCad727e8dd6eed44cA4A9b7483",
      startBlock: 1988429,
    },
    metaMorphoFactories: {
      addresses: ["0xec051b19d654C48c357dC974376DeB6272f24e53"],
      startBlock: 1988677,
    },
    preLiquidationFactory: {
      address: "0x1b6782Ac7A859503cE953FBf4736311CC335B8f0",
      startBlock: 1988956,
    },
    wNative: "0x5555555555555555555555555555555555555555",
    options: {
      vaultWhitelist: "morpho-api",
      additionalMarketsWhitelist: [],
      checkProfit: false,
      useFlashbots: false,
      blockInterval: 10,
    },
  },
};
