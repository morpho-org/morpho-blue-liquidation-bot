import { adaptiveCurveIrmAbi, metaMorphoAbi } from "@morpho-org/blue-sdk-viem";
import type { Account, Address, Chain, Client, Log, Transport } from "viem";
import { getBlock, getLogs, multicall } from "viem/actions";

import { morphoBlueAbi } from "../abis/morpho/morphoBlue";
import { preLiquidationFactoryAbi } from "../abis/morpho/preLiquidationFactory";

import {
  getMorphoHandler,
  handleBorrowRateUpdate,
  handleCreatePreLiquidation,
  handleSetWithdrawQueue,
} from "./handlers";
import type { IndexerState } from "./state";

// Extract event ABIs we care about from morphoBlueAbi
const MORPHO_EVENT_NAMES = new Set([
  "CreateMarket",
  "SetFee",
  "AccrueInterest",
  "Supply",
  "Withdraw",
  "Borrow",
  "Repay",
  "SupplyCollateral",
  "WithdrawCollateral",
  "Liquidate",
  "SetAuthorization",
]);

const morphoEventAbis = morphoBlueAbi.filter(
  (entry) => entry.type === "event" && MORPHO_EVENT_NAMES.has(entry.name),
);

const borrowRateUpdateEvent = adaptiveCurveIrmAbi.find(
  (e) => e.type === "event" && e.name === "BorrowRateUpdate",
)!;

const createPreLiquidationEvent = preLiquidationFactoryAbi.find(
  (e) => e.type === "event" && e.name === "CreatePreLiquidation",
)!;

const setWithdrawQueueEvent = metaMorphoAbi.find(
  (e) => e.type === "event" && e.name === "SetWithdrawQueue",
)!;

export interface ContractAddresses {
  morpho: Address;
  adaptiveCurveIrm: Address;
  preLiquidationFactory: Address | undefined;
  vaults: Address[];
}

export interface SyncConfig {
  client: Client<Transport, Chain, Account>;
  addresses: ContractAddresses;
}

interface TaggedLog {
  log: Log;
  source: "morpho" | "irm" | "preLiq" | "vault";
  vaultAddress?: Address;
}

const CHUNK_SIZE = 2_000_000n;

export async function syncRange(
  config: SyncConfig,
  state: IndexerState,
  fromBlock: bigint,
  toBlock: bigint,
  options?: { skipTimestamps?: boolean },
): Promise<void> {
  if (fromBlock > toBlock) return;

  const skipTimestamps = options?.skipTimestamps ?? false;
  const totalBlocks = toBlock - fromBlock + 1n;

  for (let chunkFrom = fromBlock; chunkFrom <= toBlock; chunkFrom += CHUNK_SIZE) {
    const chunkTo = chunkFrom + CHUNK_SIZE - 1n < toBlock ? chunkFrom + CHUNK_SIZE - 1n : toBlock;
    await syncRangeChunk(config, state, chunkFrom, chunkTo, skipTimestamps);

    const indexed = chunkTo - fromBlock + 1n;
    const pct = Number((indexed * 100n) / totalBlocks);
    if (pct < 100)
      console.log(
        `[Indexer] Synced ${pct}% (block ${chunkTo}) | ${state.positions.size} positions, ${state.markets.size} markets, ${state.authorizations.size} authorizations`,
      );
  }
}

/**
 * Fetch lastUpdate for all indexed markets via multicall.
 * Used after indexing from scratch (where timestamps are skipped for performance).
 */
export async function resolveLastUpdates(config: SyncConfig, state: IndexerState): Promise<void> {
  const marketIds = [...state.markets.keys()];
  if (marketIds.length === 0) return;

  const results = await multicall(config.client, {
    contracts: marketIds.map((id) => ({
      address: config.addresses.morpho,
      abi: morphoBlueAbi,
      functionName: "market" as const,
      args: [id],
    })),
    allowFailure: true,
  });

  for (let i = 0; i < marketIds.length; i++) {
    const r = results[i]!;
    if (r.status !== "success") continue;

    const market = state.markets.get(marketIds[i]!);
    if (market) {
      market.lastUpdate = (r.result as readonly bigint[])[4]!;
    }
  }
}

async function syncRangeChunk(
  config: SyncConfig,
  state: IndexerState,
  fromBlock: bigint,
  toBlock: bigint,
  skipTimestamps: boolean,
): Promise<void> {
  // Fetch all event types in parallel
  const fetches: Promise<TaggedLog[]>[] = [];

  // All Morpho Blue events in one call
  fetches.push(
    getLogs(config.client, {
      address: config.addresses.morpho,
      events: morphoEventAbis as any,
      fromBlock,
      toBlock,
    }).then((logs) => logs.map((log) => ({ log: log as Log, source: "morpho" as const }))),
  );

  // BorrowRateUpdate from AdaptiveCurveIRM
  fetches.push(
    getLogs(config.client, {
      address: config.addresses.adaptiveCurveIrm,
      event: borrowRateUpdateEvent as any,
      fromBlock,
      toBlock,
    }).then((logs) => logs.map((log) => ({ log: log as Log, source: "irm" as const }))),
  );

  // CreatePreLiquidation from factory
  if (config.addresses.preLiquidationFactory) {
    fetches.push(
      getLogs(config.client, {
        address: config.addresses.preLiquidationFactory,
        event: createPreLiquidationEvent as any,
        fromBlock,
        toBlock,
      }).then((logs) => logs.map((log) => ({ log: log as Log, source: "preLiq" as const }))),
    );
  }

  // SetWithdrawQueue per vault
  for (const vault of config.addresses.vaults) {
    fetches.push(
      getLogs(config.client, {
        address: vault,
        event: setWithdrawQueueEvent as any,
        fromBlock,
        toBlock,
      }).then((logs) =>
        logs.map((log) => ({
          log: log as Log,
          source: "vault" as const,
          vaultAddress: vault,
        })),
      ),
    );
  }

  let t0 = performance.now();
  const results = await Promise.all(fetches);
  const allLogs = results.flat();
  const fetchMs = performance.now() - t0;

  if (allLogs.length === 0) return;

  // Sort by (blockNumber, logIndex) for deterministic replay
  allLogs.sort((a, b) => {
    const blockDiff = Number((a.log.blockNumber ?? 0n) - (b.log.blockNumber ?? 0n));
    if (blockDiff !== 0) return blockDiff;
    return Number((a.log.logIndex ?? 0) - (b.log.logIndex ?? 0));
  });

  // Resolve block timestamps only for regular sync (small ranges)
  let blockTimestamps: Map<bigint, bigint> | undefined;
  if (!skipTimestamps) {
    const uniqueBlockNumbers = [...new Set(allLogs.map((e) => e.log.blockNumber!))];
    blockTimestamps = await resolveBlockTimestamps(config.client, uniqueBlockNumbers);
  }

  // Process all events in order
  t0 = performance.now();
  for (const { log, source, vaultAddress } of allLogs) {
    const decodedLog = log as any;
    const blockTimestamp = blockTimestamps?.get(log.blockNumber!) ?? 0n;

    switch (source) {
      case "morpho": {
        const handler = getMorphoHandler(decodedLog.eventName);
        if (handler) handler(state, decodedLog, blockTimestamp);
        break;
      }
      case "irm":
        handleBorrowRateUpdate(state, decodedLog);
        break;
      case "preLiq":
        handleCreatePreLiquidation(state, decodedLog);
        break;
      case "vault":
        handleSetWithdrawQueue(state, decodedLog, vaultAddress!);
        break;
    }
  }
  const processMs = performance.now() - t0;

  console.log(
    `[Indexer]   chunk ${fromBlock}-${toBlock}: ${allLogs.length} logs, fetch ${(fetchMs / 1000).toFixed(1)}s, process ${(processMs / 1000).toFixed(1)}s`,
  );
}

async function resolveBlockTimestamps(
  client: Client<Transport, Chain, Account>,
  blockNumbers: bigint[],
): Promise<Map<bigint, bigint>> {
  const timestamps = new Map<bigint, bigint>();
  const BATCH_SIZE = 500;

  for (let i = 0; i < blockNumbers.length; i += BATCH_SIZE) {
    const batch = blockNumbers.slice(i, i + BATCH_SIZE);
    const blocks = await Promise.all(batch.map((n) => getBlock(client, { blockNumber: n })));
    for (const block of blocks) {
      timestamps.set(block.number, block.timestamp);
    }
  }

  return timestamps;
}
