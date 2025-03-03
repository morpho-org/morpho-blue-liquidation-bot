import { createConfig, factory } from "ponder";
import { http } from "viem";

import { createMetaMorphoAbi, metaMorphoAbi, morphoBlueAbi } from "./abis/MorphoBlue";

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
            address: "0x1897A8997241C1cD4bD0698647e4EB7213535c24",
            event: createMetaMorphoAbi,
            parameter: "metaMorpho",
          }),
          startBlock: 21439510,
        },
        base: {
          address: factory({
            address: "0xFf62A7c278C62eD665133147129245053Bbf5918",
            event: createMetaMorphoAbi,
            parameter: "metaMorpho",
          }),
          startBlock: 23928808,
        },
      },
    },
  },
});
