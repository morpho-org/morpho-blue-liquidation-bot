import { exec, execSync, type ChildProcess } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";

loadEnv({ path: resolve(dirname(fileURLToPath(import.meta.url)), "../../../.env") });

const __dirname = dirname(fileURLToPath(import.meta.url));
const hyperindexDir = resolve(__dirname, "..");

// Docker Desktop credentials helper may not be in PATH when running from
// a spawned child process. Set DOCKER_BIN to the directory containing
// `docker-credential-desktop` if needed (e.g. on macOS:
// DOCKER_BIN=/Applications/Docker.app/Contents/Resources/bin).
const dockerBin = process.env.DOCKER_BIN;
const env = {
  ...process.env,
  ...(dockerBin ? { PATH: `${dockerBin}:${process.env.PATH}` } : {}),
};

const GRAPHQL_URL = "http://localhost:8080/v1/graphql";
const POLL_INTERVAL_MS = 2_000;
const INDEXING_TIMEOUT_MS = 20 * 60 * 1_000; // 20 minutes

/**
 * Test orchestrator for the HyperIndex indexer.
 *
 * 1. Generates the test config (mainnet only, fixed end block)
 * 2. Starts `envio dev` with the test config (handles codegen + dep install + start)
 * 3. Waits for the GraphQL endpoint to be ready and fully indexed
 * 4. Runs vitest against the indexer
 * 5. Stops the indexer and exits with the test exit code
 *
 * Caching: Envio persists its database in Docker volumes. On subsequent runs,
 * if the same block range is already indexed, the indexer should detect it and
 * skip re-indexing, making subsequent test runs fast.
 */

const END_BLOCK = 19_200_000;

async function waitForReady(): Promise<void> {
  const start = Date.now();

  // Poll the chain_metadata table to wait for the indexer to reach the end block.
  // Envio tracks progress in chain_metadata with latest_processed_block.
  const progressQuery = JSON.stringify({
    query: `{ chain_metadata(where: { chain_id: { _eq: 1 } }) { latest_processed_block } }`,
  });

  let lastBlock = -1;

  while (Date.now() - start < INDEXING_TIMEOUT_MS) {
    try {
      const response = await fetch(GRAPHQL_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: progressQuery,
      });

      if (response.ok) {
        const data = (await response.json()) as {
          data?: { chain_metadata?: { latest_processed_block: number }[] };
          errors?: unknown[];
        };
        const block = data.data?.chain_metadata?.[0]?.latest_processed_block;
        if (block != null && block !== lastBlock) {
          lastBlock = block;
          const elapsed = ((Date.now() - start) / 1000).toFixed(0);
          const pct = ((block / END_BLOCK) * 100).toFixed(1);
          console.log(`[test] Indexing progress: block ${block.toLocaleString()} / ${END_BLOCK.toLocaleString()} (${pct}%) [${elapsed}s]`);
        }
        if (block != null && block >= END_BLOCK) {
          const elapsed = ((Date.now() - start) / 1000).toFixed(0);
          console.log(`[test] Indexer fully synced (${elapsed}s)`);
          return;
        }
      }
    } catch {
      // Not ready yet (Hasura not up or table not created)
    }

    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }

  throw new Error(`[test] Timed out waiting for indexer after ${INDEXING_TIMEOUT_MS / 1000}s (last block: ${lastBlock})`);
}

function stopIndexer(): void {
  try {
    console.log("[test] Stopping indexer containers...");
    execSync("docker rm -f envio-postgres envio-hasura 2>/dev/null || true", {
      cwd: hyperindexDir,
      stdio: "inherit",
      env,
    });
  } catch {
    console.warn("[test] Warning: failed to stop indexer cleanly");
  }
}

// Ensure containers are cleaned up on unexpected termination (CI cancellation, etc.)
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    stopIndexer();
    process.exit(1);
  });
}

async function main() {
  let indexerProcess: ChildProcess | undefined;

  try {
    // 0. Clean up stale state from previous runs (important for CI)
    console.log("[test] Cleaning up stale containers and processes...");
    execSync(
      "docker rm -f envio-postgres envio-hasura 2>/dev/null || true",
      { cwd: hyperindexDir, stdio: "inherit", env },
    );
    execSync("lsof -ti :9898 | xargs kill -9 2>/dev/null || true", {
      cwd: hyperindexDir,
      stdio: "inherit",
      env,
    });

    // 1. Generate test config
    console.log("[test] Generating test config...");
    execSync("npx tsx test/generate-test-config.ts", {
      cwd: hyperindexDir,
      stdio: "inherit",
      env,
    });

    // 2. Start the indexer with `envio dev` (handles codegen, dep install, and start)
    console.log("[test] Starting indexer with envio dev...");
    indexerProcess = exec("TUI_OFF=true npx envio dev --config config.test.yaml", {
      cwd: hyperindexDir,
      env,
    });

    indexerProcess.stdout?.on("data", (data: string) => {
      process.stdout.write(`[HyperIndex] ${data}`);
    });

    indexerProcess.stderr?.on("data", (data: string) => {
      process.stderr.write(`[HyperIndex] ${data}`);
    });

    // 3. Wait for the indexer to be ready
    console.log("[test] Waiting for indexer to be ready...");
    await waitForReady();

    // 4. Run vitest
    console.log("[test] Running tests...");
    try {
      execSync("npx vitest run --config vitest.test.config.ts", {
        cwd: hyperindexDir,
        stdio: "inherit",
        env,
      });
    } catch {
      // vitest returns non-zero on test failure — propagate
      stopIndexer();
      process.exit(1);
    }

    // 5. Clean up
    stopIndexer();
    process.exit(0);
  } catch (error) {
    console.error("[test] Fatal error:", error);
    stopIndexer();
    process.exit(1);
  }
}

main();
