import { base, mainnet } from "viem/chains";
import type { Config, EnvVariables } from "./types";

export const chainConfigs: Record<number, Config & EnvVariables> = {
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
    vaultWhitelist: [
      "0xBEEF01735c132Ada46AA9aA4c54623cAA92A64CB",
      "0x8eB67A509616cd6A7c1B3c8C21D48FF57df3d458",
      "0xBEEf050ecd6a16c4e7bfFbB52Ebba7846C4b8cD4",
    ],
    additionalMarketsWhitelist: [],
    rpcUrl: process.env.MAINNET_RPC_URL ?? mainnet.rpcUrls.default.http[0],
    executorAddress: process.env.EXECUTOR_ADDRESS_MAINNET,
    liquidationPrivateKey: process.env.LIQUIDATION_PRIVATE_KEY_MAINNET,
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
    vaultWhitelist: [],
    additionalMarketsWhitelist: [],
    rpcUrl: process.env.BASE_RPC_URL ?? base.rpcUrls.default.http[0],
    executorAddress: process.env.EXECUTOR_ADDRESS_BASE,
    liquidationPrivateKey: process.env.LIQUIDATION_PRIVATE_KEY_BASE,
  },
};
