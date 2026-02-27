import dotenv from "dotenv";
import type { Address, Chain, Hex } from "viem";

import { chainConfigs } from "./config";
import type { ChainConfig, LiquidityVenueName, PricerName } from "./types";

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

  const { rpcUrl, executorAddress, liquidationPrivateKey } = getSecrets(chainId, config.chain);
  return {
    // Hoist all parameters from `options` up 1 level, i.e. flatten the config as much as possible.
    ...(({ options, ...c }) => ({ ...options, ...c }))(config),
    chainId,
    rpcUrl,
    executorAddress,
    liquidationPrivateKey,
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

export * from "./chains";
export { chainConfigs, type ChainConfig, type LiquidityVenueName, type PricerName };
export * from "./liquidityVenues";
export * from "./pricers";
export {
  POSITION_LIQUIDATION_COOLDOWN_PERIOD,
  POSITION_LIQUIDATION_COOLDOWN_ENABLED,
  MARKETS_FETCHING_COOLDOWN_PERIOD,
  ALWAYS_REALIZE_BAD_DEBT,
} from "./config";
