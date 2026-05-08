import dotenv from "dotenv";
import type { Address, Chain, Hex } from "viem";

import { chainConfigs } from "./config";
import type { ChainConfig, DataProviderName, LiquidityVenueName, PricerName } from "./types";

dotenv.config();

export function chainConfig(chainId: number): ChainConfig {
  const config = chainConfigs[chainId];
  if (!config) {
    throw new Error(`No config found for chainId ${chainId}`);
  }

  const { vaultWhitelist, additionalMarketsWhitelist } = config.options;
  if (vaultWhitelist.length === 0 && additionalMarketsWhitelist.length === 0) {
    throw new Error(
      `Vault whitelist and additional markets whitelist both empty for chainId ${chainId}`,
    );
  }

  const { rpcUrl, fallbackRpcUrls, executorAddress, liquidationPrivateKey } = getSecrets(
    chainId,
    config.chain,
  );
  return {
    // Hoist all parameters from `options` up 1 level, i.e. flatten the config as much as possible.
    ...(({ options, ...c }) => ({ ...options, ...c }))(config),
    chainId,
    rpcUrl,
    fallbackRpcUrls,
    executorAddress,
    liquidationPrivateKey,
  };
}

export function getSecrets(chainId: number, chain?: Chain) {
  const defaultRpcUrls = chain?.rpcUrls.default.http ?? [];

  // RPC_URL_<chainId> supports comma-separated URLs for rotation, e.g. "url1,url2,url3".
  const envRpcUrls = (process.env[`RPC_URL_${chainId}`] ?? "")
    .split(",")
    .map((u) => u.trim())
    .filter(Boolean);
  // Merge env URLs with chain defaults, deduped, env first.
  const allRpcUrls = [...new Set([...envRpcUrls, ...defaultRpcUrls])];

  const rpcUrl = allRpcUrls[0];
  const fallbackRpcUrls = allRpcUrls.slice(1);

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
    fallbackRpcUrls,
    executorAddress: executorAddress as Address,
    liquidationPrivateKey: liquidationPrivateKey as Hex,
  };
}

export * from "./chains";
export {
  chainConfigs,
  type ChainConfig,
  type DataProviderName,
  type LiquidityVenueName,
  type PricerName,
};
export * from "./dataProviders";
export * from "./liquidityVenues";
export * from "./pricers";
export {
  POSITION_LIQUIDATION_COOLDOWN_PERIOD,
  POSITION_LIQUIDATION_COOLDOWN_ENABLED,
  MARKETS_FETCHING_COOLDOWN_PERIOD,
  ALWAYS_REALIZE_BAD_DEBT,
} from "./config";
