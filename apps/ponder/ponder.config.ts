import { createConfig, factory } from "ponder";
import { getAbiItem, http } from "viem";

import { adaptiveCurveIrmAbi } from "./abis/AdaptiveCurveIrm";
import { metaMorphoAbi } from "./abis/MetaMorpho";
import { metaMorphoFactoryAbi } from "./abis/MetaMorphoFactory";
import { morphoBlueAbi } from "./abis/MorphoBlue";

export default createConfig({
  networks: {
    mainnet: { chainId: 1, transport: http(process.env.PONDER_RPC_URL_1) },
    base: { chainId: 8453, transport: http(process.env.PONDER_RPC_URL_8453) },
  },
  contracts: {
    Morpho: {
      abi: morphoBlueAbi,
      network: {
        mainnet: {
          address: "0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb",
          startBlock: 18883124,
        },
        base: {
          address: "0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb",
          startBlock: 13977148,
        },
      },
    },
    MetaMorpho: {
      abi: metaMorphoAbi,
      network: {
        mainnet: {
          address: factory({
            address: [
              "0x1897A8997241C1cD4bD0698647e4EB7213535c24",
              "0xA9c3D3a366466Fa809d1Ae982Fb2c46E5fC41101",
            ],
            event: getAbiItem({ abi: metaMorphoFactoryAbi, name: "CreateMetaMorpho" }),
            parameter: "metaMorpho",
          }),
          startBlock: 18925584,
        },
        base: {
          address: factory({
            address: [
              "0xFf62A7c278C62eD665133147129245053Bbf5918",
              "0xA9c3D3a366466Fa809d1Ae982Fb2c46E5fC41101",
            ],
            event: getAbiItem({ abi: metaMorphoFactoryAbi, name: "CreateMetaMorpho" }),
            parameter: "metaMorpho",
          }),
          startBlock: 13978134,
        },
      },
    },
    AdaptiveCurveIRM: {
      abi: adaptiveCurveIrmAbi,
      network: {
        mainnet: {
          address: "0x870aC11D48B15DB9a138Cf899d20F13F79Ba00BC",
          startBlock: 18883124,
        },
        base: {
          address: "0x46415998764C29aB2a25CbeA6254146D50D22687",
          startBlock: 13977152,
        },
      },
    },
  },
});
