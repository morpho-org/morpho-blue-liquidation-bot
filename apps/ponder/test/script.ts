import { spawn } from "node:child_process";

const PONDER_API = "http://localhost:42069/ready";

import dotenv from "dotenv";

async function waitForIndexing(maxWaitMs = 20 * 60 * 1000) {
  const start = Date.now();
  return new Promise<void>((resolve, reject) => {
    const interval = setInterval(async () => {
      if (Date.now() - start > maxWaitMs) {
        clearInterval(interval);
        reject(new Error("⏱ Timeout: indexing is too long"));
        return;
      }

      try {
        const res = await fetch(PONDER_API);
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
  dotenv.config();

  const ponder = spawn(
    "pnpm",
    ["ponder", "start", "--schema", "public", "--config", "test/ponder.config.ts"],
    { stdio: "inherit" },
  );

  console.log("Ponder is indexing...");

  try {
    await waitForIndexing();

    const tests = spawn("pnpm", ["vitest", "indexer", "run"], { stdio: "inherit" });

    tests.on("exit", (code) => {
      console.log("🧪 Tests over");
      ponder.kill("SIGTERM");
      process.exit(code ?? 1);
    });
  } catch (err) {
    console.error(err);
    ponder.kill("SIGTERM");
    process.exit(1);
  }
}

run();
