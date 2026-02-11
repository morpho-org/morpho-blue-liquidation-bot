import { type ChildProcess, spawn } from "node:child_process";

import { chainConfigs, chainConfig } from "@morpho-blue-liquidation-bot/config";

import { startHealthServer } from "./health";

import { launchBot } from ".";

const MAX_PONDER_RESTARTS = 10;
const RESTART_BACKOFF_MS = 5000;

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

/**
 * Spawns the Ponder indexer process and attaches an exit handler that
 * sets `ponderExited` to true so the polling loop can detect the crash.
 */
function spawnPonder(): { process: ChildProcess; exited: { value: boolean; code: number | null } } {
  const state = { value: false, code: null as number | null };
  const child = spawn(
    "pnpm",
    ["ponder", "start", "--schema", "public", "--config", "ponder.config.ts"],
    { stdio: "inherit", cwd: "apps/ponder" },
  );

  child.on("exit", (code) => {
    state.value = true;
    state.code = code;
    console.error(`⚠️ Ponder process exited with code ${code}`);
  });

  console.log("→ Spawning ponder...");
  return { process: child, exited: state };
}

async function waitForIndexing(
  apiUrl: string,
  exitState?: { value: boolean; code: number | null },
) {
  while (!(await isPonderReady(apiUrl))) {
    // If we spawned Ponder locally and it crashed, bail out instead of looping forever
    if (exitState?.value) {
      throw new Error(`Ponder process crashed with exit code ${exitState.code}`);
    }
    console.log("⏳ Ponder is indexing");
    await sleep(1000);
  }
}

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

  const apiUrl = process.env.PONDER_SERVICE_URL ?? "http://localhost:42069";
  const shouldExpectPonderToRunLocally =
    apiUrl.includes("localhost") || apiUrl.includes("0.0.0.0") || apiUrl.includes("127.0.0.1");

  let ponder:
    | { process: ChildProcess; exited: { value: boolean; code: number | null } }
    | undefined;
  let restartCount = 0;

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

    // Spawn Ponder with crash detection and auto-restart
    while (restartCount <= MAX_PONDER_RESTARTS) {
      ponder = spawnPonder();

      try {
        await waitForIndexing(apiUrl, ponder.exited);
        // Ponder is ready, break out of the restart loop
        break;
      } catch (err) {
        restartCount++;
        console.error(`Ponder indexing error: ${err}`);
        if (restartCount > MAX_PONDER_RESTARTS) {
          console.error(
            `❌ Ponder crashed ${MAX_PONDER_RESTARTS} times during indexing, giving up.`,
          );
          process.exit(1);
        }
        const backoff = RESTART_BACKOFF_MS * restartCount;
        console.warn(
          `🔄 Ponder crashed during indexing (attempt ${restartCount}/${MAX_PONDER_RESTARTS}). ` +
            `Restarting in ${backoff / 1000}s...`,
        );
        // Ensure old process is cleaned up
        try {
          ponder.process.kill("SIGTERM");
        } catch {
          /* already dead */
        }
        await sleep(backoff);
      }
    }
  } else {
    // Ponder is managed externally, just wait for it
    try {
      await waitForIndexing(apiUrl);
    } catch (err) {
      console.error(err);
      process.exit(1);
    }
  }

  try {
    console.log("✅ Ponder is ready");

    // Start health server
    await startHealthServer();

    // biome-ignore lint/complexity/noForEach: <explanation>
    configs.forEach((config) => {
      launchBot(config);
    });
  } catch (err) {
    console.error(err);
    if (ponder) ponder.process.kill("SIGTERM");
    process.exit(1);
  }
}

void run();
