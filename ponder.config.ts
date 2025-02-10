import { createConfig } from "ponder";
import { http } from "viem";

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
  },
});
