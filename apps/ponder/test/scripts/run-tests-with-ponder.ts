import { spawn } from "node:child_process";

const PONDER_API = "http://localhost:42069/ready";

console.log("Ponder is indexing...");

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
  const ponder = spawn(
    "pnpm",
    ["ponder", "start", "--schema", "test/ponder.schema.ts", "--config", "test/ponder.config.ts"],
    { stdio: "inherit" },
  );
  try {
    await waitForIndexing();

    const tests = spawn("pnpm", ["vitest", "run"], { stdio: "inherit" });

    tests.on("exit", (code) => {
      console.log(`🧪 Tests over ${code}`);
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
