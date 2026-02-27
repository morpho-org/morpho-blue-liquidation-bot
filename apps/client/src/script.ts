import { chainConfigs, chainConfig } from "@morpho-blue-liquidation-bot/config";

import { startHealthServer } from "./health";

import { launchBot } from ".";

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

  try {
    // Start health server
    await startHealthServer();

    // biome-ignore lint/complexity/noForEach: <explanation>
    configs.forEach((config) => {
      launchBot(config);
    });
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

void run();
