import { base, mainnet, unichain } from "viem/chains";

import type { Config } from "./types";

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
      vaultWhitelist: [
        "0xBEEF01735c132Ada46AA9aA4c54623cAA92A64CB",
        "0x8eB67A509616cd6A7c1B3c8C21D48FF57df3d458",
      ],
      additionalMarketsWhitelist: [
        "0x1eda1b67414336cab3914316cb58339ddaef9e43f939af1fed162a989c98bc20",
      ],
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
      vaultWhitelist: ["0xbeeF010f9cb27031ad51e3333f9aF9C6B1228183"],
      additionalMarketsWhitelist: [],
      checkProfit: true,
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
    },
  },
};
