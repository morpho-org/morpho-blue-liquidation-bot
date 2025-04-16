import { spawn } from "node:child_process";
import { chainConfigs, chainConfig } from "@morpho-blue-liquidation-bot/config";
import { launchBot } from ".";

const PONDER_API_CHECK = "http://localhost:42069/ready";

async function waitForIndexing() {
  return new Promise<void>((resolve) => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch(PONDER_API_CHECK);
        if (res.status === 200) {
          console.log("✅ indexing is done");
          clearInterval(interval);
          resolve();
        }
      } catch {}
    }, 1000);
  });
}

async function run() {
  const configs = Object.keys(chainConfigs).map((config) => chainConfig(Number(config)));

  if (process.env.POSTGRES_DATABASE_URL === undefined) {
    spawn("docker", ["compose", "up", "-d"]);
    console.log("Waiting for postgres to be ready...");
    await new Promise((resolve) => setTimeout(resolve, 5000));
  }

  const ponder = spawn(
    "pnpm",
    ["ponder", "start", "--schema", "ponder.schema.ts", "--config", "ponder.config.ts"],
    { stdio: "inherit", cwd: "apps/ponder" },
  );

  console.log("Ponder is indexing...");

  try {
    await waitForIndexing();

    // biome-ignore lint/complexity/noForEach: <explanation>
    configs.forEach((config) => launchBot(config));
  } catch (err) {
    console.error(err);
    ponder.kill("SIGTERM");
    process.exit(1);
  }
}

run();
