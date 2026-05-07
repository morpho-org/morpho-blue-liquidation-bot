import {
  chainConfigs,
  chainConfig,
  type DataProviderName,
} from "@morpho-blue-liquidation-bot/config";
import {
  createDataProviders,
  type DataProvider,
} from "@morpho-blue-liquidation-bot/data-providers";

import { startHealthServer } from "./health";
import { createTelegramNotifier } from "./utils/telegram.js";

import { launchBot } from ".";

process.on("unhandledRejection", (reason) => {
  console.error("Unhandled rejection:", reason);
});

process.on("uncaughtException", (error) => {
  console.error("Uncaught exception:", error);
});

async function run() {
  const configs = Object.keys(chainConfigs)
    .map((config) => {
      try {
        return chainConfig(Number(config));
      } catch {
        return undefined;
      }
    })
    .filter((config) => config !== undefined);

  const selectedChainIds = (() => {
    const chainIdsEnv = process.env.CHAIN_IDS ?? process.env.CHAIN_ID;
    if (!chainIdsEnv) return undefined;

    return chainIdsEnv
      .split(",")
      .map((id) => Number(id.trim()))
      .filter((id) => Number.isInteger(id) && id > 0);
  })();

  const filteredConfigs = selectedChainIds?.length
    ? configs.filter((config) => selectedChainIds.includes(config.chainId))
    : configs;

  if (selectedChainIds?.length) {
    console.log(`Starting bot on selected chainIds: ${selectedChainIds.join(", ")}`);
  }

  // Group chains by data provider name
  const chainsByProvider = new Map<DataProviderName, number[]>();
  for (const config of filteredConfigs) {
    const existing = chainsByProvider.get(config.dataProvider) ?? [];
    existing.push(config.chainId);
    chainsByProvider.set(config.dataProvider, existing);
  }

  // Create data providers (one per provider type, shared across chains)
  const providersByChain = new Map<number, DataProvider>();
  for (const [providerName, chainIds] of chainsByProvider) {
    const providers = await createDataProviders(providerName, chainIds);
    for (const [chainId, provider] of providers) {
      providersByChain.set(chainId, provider);
    }
  }

  try {
    await startHealthServer();
  } catch (err) {
    console.error("Failed to start health server:", err);
  }

  for (const config of filteredConfigs) {
    const dataProvider = providersByChain.get(config.chainId);
    if (!dataProvider) {
      console.error(`No data provider for chain ${config.chainId}, skipping`);
      continue;
    }
    try {
      launchBot(config, dataProvider);
    } catch (err) {
      console.error(`Failed to launch bot for chain ${config.chainId}:`, err);
    }
  }

  // Send startup notification
  const notifier = createTelegramNotifier();
  if (notifier) {
    const launchedChainIds = filteredConfigs.map((config) => config.chainId);
    await notifier.botStarted(launchedChainIds);
  }
}

void run();
