import * as Sentry from "@sentry/node";

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

import { launchBot } from ".";

// Initialize Sentry as early as possible
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV || "development",
  sampleRate: 1,
  tracesSampleRate: 0,
  debug: process.env.NODE_ENV === "development",
  integrations: [
    // Automatically instrument Node.js libraries and frameworks
    Sentry.httpIntegration(),
    Sentry.consoleLoggingIntegration({ levels: ["info"] }),
  ],
  enableLogs: true,
});

// Capture unhandled promise rejections
process.on("unhandledRejection", (reason, promise) => {
  Sentry.captureException(reason, {
    contexts: {
      unhandledRejection: {
        promise: promise.toString(),
      },
    },
  });
});

// Capture uncaught exceptions
process.on("uncaughtException", (error) => {
  Sentry.captureException(error);
  // Re-throw to maintain default behavior
  throw error;
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

  // Group chains by data provider name
  const chainsByProvider = new Map<DataProviderName, number[]>();
  for (const config of configs) {
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

    for (const config of configs) {
      const dataProvider = providersByChain.get(config.chainId);
      if (!dataProvider) {
        console.error(`No data provider for chain ${config.chainId}, skipping`);
        continue;
      }
      launchBot(config, dataProvider);
    }
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

void run();
