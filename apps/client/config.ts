import { base, mainnet } from "viem/chains";
import type { Address, Hex } from "viem";
import type { ChainConfig } from "./src/utils/types";

export const chainConfigs: Record<number, ChainConfig> = {
  [mainnet.id]: {
    chain: mainnet,
    vaultWhitelist: [
      "0xBEEF01735c132Ada46AA9aA4c54623cAA92A64CB",
      "0x8eB67A509616cd6A7c1B3c8C21D48FF57df3d458",
      "0xBEEf050ecd6a16c4e7bfFbB52Ebba7846C4b8cD4",
    ],
    rpcUrl: process.env.MAINNET_RPC_URL ?? mainnet.rpcUrls.default.http[0],
    executorAddress: (process.env.EXECUTOR_ADDRESS_MAINNET as Address) ?? "",
    liquidationPrivateKey: (process.env.LIQUIDATION_PRIVATE_KEY_MAINNET as Hex) ?? "",
  },
  [base.id]: {
    chain: base,
    vaultWhitelist: [],
    rpcUrl: process.env.BASE_RPC_URL ?? base.rpcUrls.default.http[0],
    executorAddress: (process.env.EXECUTOR_ADDRESS_BASE as Address) ?? "",
    liquidationPrivateKey: (process.env.LIQUIDATION_PRIVATE_KEY_BASE as Hex) ?? "",
  },

  /// TODO: handle cases where executorAddress and/or liquidationPrivateKey are not set
};
