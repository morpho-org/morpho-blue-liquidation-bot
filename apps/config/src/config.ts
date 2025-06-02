import { base, mainnet, unichain } from "viem/chains";

import type { Config } from "./types";

export const chainConfigs: Record<number, Config> = {
  // [mainnet.id]: {
  //   chain: mainnet,
  //   morpho: {
  //     address: "0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb",
  //     startBlock: 18883124,
  //   },
  //   adaptiveCurveIrm: {
  //     address: "0x870aC11D48B15DB9a138Cf899d20F13F79Ba00BC",
  //     startBlock: 18883124,
  //   },
  //   metaMorphoFactories: {
  //     addresses: [
  //       "0x1897A8997241C1cD4bD0698647e4EB7213535c24",
  //       "0xA9c3D3a366466Fa809d1Ae982Fb2c46E5fC41101",
  //     ],
  //     startBlock: 18925584,
  //   },
  // },
  // [base.id]: {
  //   chain: base,
  //   morpho: {
  //     address: "0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb",
  //     startBlock: 13977148,
  //   },
  //   adaptiveCurveIrm: {
  //     address: "0x46415998764C29aB2a25CbeA6254146D50D22687",
  //     startBlock: 13977152,
  //   },
  //   metaMorphoFactories: {
  //     addresses: [
  //       "0xFf62A7c278C62eD665133147129245053Bbf5918",
  //       "0xA9c3D3a366466Fa809d1Ae982Fb2c46E5fC41101",
  //     ],
  //     startBlock: 13978134,
  //   },
  // },
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
  },
};
