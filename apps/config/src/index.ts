import type { Address, Chain, Hex } from "viem";
import { chainConfigs } from "./config";
import type { ChainConfig } from "./types";
import dotenv from "dotenv";

dotenv.config();

export function chainConfig(chainId: number): ChainConfig {
  const config = chainConfigs[chainId];
  if (!config) {
    throw new Error(`No config found for chainId ${chainId}`);
  }

  const { vaultWhitelist, additionalMarketsWhitelist, checkProfit } = config.options;
  if (vaultWhitelist.length === 0 && additionalMarketsWhitelist.length === 0) {
    throw new Error(
      `Vault whitelist and additional markets whitelist both empty for chainId ${chainId}`,
    );
  }

  const { rpcUrl, executorAddress, liquidationPrivateKey } = getSecrets(chainId, config.chain);
  return {
    ...config,
    chainId,
    rpcUrl,
    executorAddress,
    liquidationPrivateKey,
    vaultWhitelist,
    additionalMarketsWhitelist,
    checkProfit,
  };
}

export function getSecrets(chainId: number, chain?: Chain) {
  const defaultRpcUrl = chain?.rpcUrls.default.http[0];

  const rpcUrl = process.env[`RPC_URL_${chainId}`] ?? defaultRpcUrl;
  const executorAddress = process.env[`EXECUTOR_ADDRESS_${chainId}`];
  const liquidationPrivateKey = process.env[`LIQUIDATION_PRIVATE_KEY_${chainId}`];

  if (!rpcUrl) {
    throw new Error(`No RPC URL found for chainId ${chainId}`);
  }
  if (!executorAddress) {
    throw new Error(`No executor address found for chainId ${chainId}`);
  }
  if (!liquidationPrivateKey) {
    throw new Error(`No liquidation private key found for chainId ${chainId}`);
  }
  return {
    rpcUrl,
    executorAddress: executorAddress as Address,
    liquidationPrivateKey: liquidationPrivateKey as Hex,
  };
}

export { chainConfigs, type ChainConfig };
export * from "./liquidityVenues";
