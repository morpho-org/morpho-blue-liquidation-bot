import type { Address, Hex } from "viem";
import { chainConfigs } from "./config";
import type { ChainConfig } from "./types";

export function chainConfig(chainId: number): ChainConfig {
  const config = chainConfigs[chainId];
  if (!config) {
    throw new Error(`No config found for chainId ${chainId}`);
  }
  if (!config.rpcUrl) {
    throw new Error(`No RPC URL found for chainId ${chainId}`);
  }
  if (!config.executorAddress) {
    throw new Error(`No executor address found for chainId ${chainId}`);
  }
  if (!config.liquidationPrivateKey) {
    throw new Error(`No liquidation private key found for chainId ${chainId}`);
  }
  return {
    ...config,
    ponderRpcUrl: config.ponderRpcUrl ?? config.rpcUrl,
    rpcUrl: config.rpcUrl,
    executorAddress: config.executorAddress as Address,
    liquidationPrivateKey: config.liquidationPrivateKey as Hex,
  };
}
