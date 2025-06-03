import { type ChildProcess, spawn } from "node:child_process";

import { chainConfigs, chainConfig } from "@morpho-blue-liquidation-bot/config";

import { launchBot } from ".";

async function sleep(ms: number) {
  return new Promise<void>((resolve) =>
    setTimeout(() => {
      resolve();
    }, ms),
  );
}

async function isPonderReady(apiUrl: string) {
  try {
    const response = await fetch(`${apiUrl}/ready`);
    return response.status === 200;
  } catch {
    return false;
  }
}

async function waitForIndexing(apiUrl: string) {
  while (!(await isPonderReady(apiUrl))) {
    await sleep(1000);
  }
}

async function run() {
  let ponder: ChildProcess | undefined;
  let apiUrl = "http://localhost:42069";

  const configs = Object.keys(chainConfigs).map((config) => chainConfig(Number(config)));

  if (process.env.PONDER_SERVICE_URL !== undefined) {
    apiUrl = process.env.PONDER_SERVICE_URL;
  } else {
    if (process.env.POSTGRES_DATABASE_URL === undefined) {
      spawn("docker", ["compose", "up", "-d"]);
      console.log("Waiting for postgres to be ready...");
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }

    ponder = spawn(
      "pnpm",
      ["ponder", "start", "--schema", "ponder.schema.ts", "--config", "ponder.config.ts"],
      { stdio: "inherit", cwd: "apps/ponder" },
    );

    console.log("Ponder is indexing...");
  }

  try {
    await waitForIndexing(apiUrl);

    // biome-ignore lint/complexity/noForEach: <explanation>
    configs.forEach((config) => {
      launchBot(config);
    });
  } catch (err) {
    console.error(err);
    if (ponder) ponder.kill("SIGTERM");
    process.exit(1);
  }
}

void run();
