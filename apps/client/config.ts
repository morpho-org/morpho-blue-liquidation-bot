import { base, mainnet } from "viem/chains";
import type { Address, Hex } from "viem";
import type { ChainConfig } from "./src/utils/types";

export const chainConfigs: Record<number, ChainConfig> = {
  [mainnet.id]: {
    chain: mainnet,
    vaultWhitelist: [],
    rpcUrl: process.env.RPC_URL_MAINNET ?? mainnet.rpcUrls.default.http[0],
    executorAddress: (process.env.EXECUTOR_ADDRESS_MAINNET as Address) ?? "",
    liquidationPrivateKey: (process.env.LIQUIDATION_PRIVATE_KEY_MAINNET as Hex) ?? "",
  },
  [base.id]: {
    chain: base,
    vaultWhitelist: [],
    rpcUrl: process.env.RPC_URL_BASE ?? base.rpcUrls.default.http[0],
    executorAddress: (process.env.EXECUTOR_ADDRESS_BASE as Address) ?? "",
    liquidationPrivateKey: (process.env.LIQUIDATION_PRIVATE_KEY_BASE as Hex) ?? "",
  },

  /// TODO: handle cases where executorAddress and/or liquidationPrivateKey are not set
};
