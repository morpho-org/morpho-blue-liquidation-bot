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

async function isPonderRunning(apiUrl: string) {
  try {
    const controller = new AbortController();
    setTimeout(() => {
      controller.abort();
    }, 5000);
    await fetch(`${apiUrl}/ready`, { signal: controller.signal });
    return true;
  } catch {
    return false;
  }
}

async function isPonderReady(apiUrl: string) {
  try {
    const response = await fetch(`${apiUrl}/ready`);
    return response.status === 200;
  } catch (e) {
    // @ts-expect-error: error cause is poorly typed.
    if (e instanceof TypeError && e.cause?.code === "ENOTFOUND") {
      console.warn(`⚠️ The ponder service at ${apiUrl} is unreachable. Please check your config.`);
    }
    return false;
  }
}

async function waitForIndexing(apiUrl: string) {
  while (!(await isPonderReady(apiUrl))) {
    console.log("⏳ Ponder is indexing");
    await sleep(1000);
  }
}

async function run() {
  let ponder: ChildProcess | undefined;

  const configs = Object.keys(chainConfigs)
    .map((config) => {
      try {
        return chainConfig(Number(config));
      } catch {
        return undefined;
      }
    })
    .filter((config) => config !== undefined);

  const apiUrl = process.env.PONDER_SERVICE_URL ?? "http://localhost:42069";
  const shouldExpectPonderToRunLocally =
    apiUrl.includes("localhost") || apiUrl.includes("0.0.0.0") || apiUrl.includes("127.0.0.1");

  // If the ponder service isn't responding, see if we can start it.
  if (shouldExpectPonderToRunLocally && !(await isPonderRunning(apiUrl))) {
    console.log("🚦 Starting ponder service locally:");
    // If `POSTGRES_DATABASE_URL === undefined`, we assume postgres is meant to be run locally.
    // Start that first.
    if (process.env.POSTGRES_DATABASE_URL === undefined) {
      spawn("docker", ["compose", "up", "-d"]);
      console.log("→ Spawning docker container for postgres...");
      await sleep(5000);
    }

    // Then start ponder service, regardless of where database is.
    ponder = spawn(
      "pnpm",
      ["ponder", "start", "--schema", "ponder.schema.ts", "--config", "ponder.config.ts"],
      { stdio: "inherit", cwd: "apps/ponder" },
    );

    console.log("→ Spawning ponder...");
  }

  try {
    await waitForIndexing(apiUrl);
    console.log("✅ Ponder is ready");

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
