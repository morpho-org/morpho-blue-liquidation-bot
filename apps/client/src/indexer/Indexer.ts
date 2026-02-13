import type { RebuildConfig } from "@morpho-blue-liquidation-bot/config";
import {
  AccrualPosition,
  Market,
  MarketParams,
  PreLiquidationPosition,
  getChainAddresses,
} from "@morpho-org/blue-sdk";
import { metaMorphoAbi } from "@morpho-org/blue-sdk-viem";
import { Time } from "@morpho-org/morpho-ts";
import type { Account, Address, Chain, Client, Hex, Transport } from "viem";
import { zeroAddress } from "viem";
import { getBlockNumber, getLogs, multicall } from "viem/actions";

import { oracleAbi } from "../abis/morpho/oracle";

import { MissingEventError } from "./handlers";
import { spotCheck } from "./spotCheck";
import {
  createEmptyState,
  cloneState,
  authorizationKey,
  type IndexerState,
  type IndexedMarketState,
} from "./state";
import { syncRange, type SyncConfig, type ContractAddresses } from "./sync";

const MAX_RETRIES = 5;
const INITIAL_BACKOFF_MS = 1000;

export class Indexer {
  private client: Client<Transport, Chain, Account>;
  private state: IndexerState;
  private lastSyncedBlock: bigint;
  private startBlock: bigint;
  private maxBlockRange: bigint;
  private addresses: ContractAddresses;
  private trackedVaults: Set<string>;
  private isSyncing = false;
  private rebuildConfig: RebuildConfig | undefined;
  private lastResilienceRun: { rebuild: number; spotCheck: number };

  constructor(options: {
    client: Client<Transport, Chain, Account>;
    startBlock: bigint;
    maxBlockRange?: number;
    vaultAddresses: Address[];
    rebuild?: RebuildConfig;
  }) {
    this.client = options.client;
    this.startBlock = options.startBlock;

    const range = options.maxBlockRange ?? 10_000;
    this.maxBlockRange = Number.isFinite(range) ? BigInt(range) : 100_000_000n;

    this.trackedVaults = new Set(options.vaultAddresses.map((v) => v.toLowerCase()));
    this.rebuildConfig = options.rebuild;
    this.lastResilienceRun = { rebuild: Date.now(), spotCheck: Date.now() };

    const chainAddresses = getChainAddresses(options.client.chain.id);
    this.addresses = {
      morpho: chainAddresses.morpho,
      adaptiveCurveIrm: chainAddresses.adaptiveCurveIrm,
      preLiquidationFactory: chainAddresses.preLiquidationFactory,
      vaults: options.vaultAddresses,
    };

    this.state = createEmptyState();
    this.lastSyncedBlock = options.startBlock - 1n;
  }

  async init(): Promise<void> {
    await this.indexFromScratch();
  }

  async sync(): Promise<void> {
    if (this.isSyncing) return;
    this.isSyncing = true;
    try {
      await this.syncWithRetry();
      await this.rebuildIfNeeded();
    } finally {
      this.isSyncing = false;
    }
  }

  private async rebuildIfNeeded(): Promise<void> {
    if (!this.rebuildConfig) return;

    // Spot-check: sample markets+positions vs on-chain state
    const spotCheckConfig = this.rebuildConfig.spotCheck;
    if (
      spotCheckConfig != null &&
      Date.now() - this.lastResilienceRun.spotCheck >= spotCheckConfig.intervalMs
    ) {
      this.lastResilienceRun.spotCheck = Date.now();
      const sampleSize = spotCheckConfig.sampleSize ?? 10;
      const mismatches = await spotCheck(
        this.client,
        this.state,
        this.addresses.morpho,
        this.lastSyncedBlock,
        sampleSize,
      );
      if (mismatches.length > 0) {
        await this.rebuild();
        return;
      }
    }

    // Periodic rebuild from cached logs
    if (
      this.rebuildConfig.intervalMs != null &&
      Date.now() - this.lastResilienceRun.rebuild >= this.rebuildConfig.intervalMs
    ) {
      await this.rebuild();
    }
  }

  private async syncWithRetry(): Promise<void> {
    const latestBlock = await getBlockNumber(this.client);
    if (latestBlock <= this.lastSyncedBlock) return;

    const startFrom = this.lastSyncedBlock + 1n;

    // Process in chunks of maxBlockRange to respect RPC limits
    try {
      let chunkFrom = startFrom;
      while (chunkFrom <= latestBlock) {
        const chunkTo =
          chunkFrom + this.maxBlockRange - 1n < latestBlock
            ? chunkFrom + this.maxBlockRange - 1n
            : latestBlock;

        await this.syncChunkWithRetry(chunkFrom, chunkTo);
        chunkFrom = chunkTo + 1n;
      }
    } catch (error) {
      if (error instanceof MissingEventError) {
        await this.rebuild();
        return;
      }
      throw error;
    }
  }

  private async syncChunkWithRetry(fromBlock: bigint, toBlock: bigint): Promise<void> {
    let retries = 0;
    while (retries <= MAX_RETRIES) {
      try {
        // Clone state for transactional sync
        const stateCopy = cloneState(this.state);

        await syncRange(this.getSyncConfig(), stateCopy, fromBlock, toBlock);

        // Success: swap in new state
        this.state = stateCopy;
        this.lastSyncedBlock = toBlock;
        return;
      } catch (error) {
        // MissingEventError means corrupted state from a missed log — retrying won't help
        if (error instanceof MissingEventError) throw error;

        retries++;
        if (retries > MAX_RETRIES) throw error;

        const backoff = INITIAL_BACKOFF_MS * Math.pow(2, retries - 1);
        await new Promise((resolve) => setTimeout(resolve, backoff));
      }
    }
  }

  private getSyncConfig(): SyncConfig {
    return {
      client: this.client,
      addresses: this.addresses,
    };
  }

  private async indexFromScratch(): Promise<void> {
    const latestBlock = await getBlockNumber(this.client);
    const freshState = createEmptyState();

    // Replay all cached logs from startBlock to latestBlock in chunks
    let chunkFrom = this.startBlock;
    while (chunkFrom <= latestBlock) {
      const chunkTo =
        chunkFrom + this.maxBlockRange - 1n < latestBlock
          ? chunkFrom + this.maxBlockRange - 1n
          : latestBlock;

      await syncRange(this.getSyncConfig(), freshState, chunkFrom, chunkTo);
      chunkFrom = chunkTo + 1n;
    }

    this.state = freshState;
    this.lastSyncedBlock = latestBlock;
  }

  private async rebuild(): Promise<void> {
    await this.indexFromScratch();
    this.lastResilienceRun.rebuild = Date.now();
  }

  updateVaultAddresses(vaults: Address[]): void {
    const newVaults = vaults.filter((v) => !this.trackedVaults.has(v.toLowerCase()));

    this.addresses.vaults = vaults;
    for (const v of vaults) {
      this.trackedVaults.add(v.toLowerCase());
    }

    // Sync SetWithdrawQueue for newly discovered vaults from startBlock
    if (newVaults.length > 0) {
      void this.syncNewVaults(newVaults);
    }
  }

  private async syncNewVaults(newVaults: Address[]): Promise<void> {
    const setWithdrawQueueEvent = metaMorphoAbi.find(
      (e) => e.type === "event" && e.name === "SetWithdrawQueue",
    )!;

    try {
      const results = await Promise.all(
        newVaults.map((vault) =>
          getLogs(this.client, {
            address: vault,
            event: setWithdrawQueueEvent as any,
            fromBlock: this.startBlock,
          }).then((logs) => ({ vault, logs })),
        ),
      );

      for (const { vault, logs } of results) {
        // Apply only the latest SetWithdrawQueue for each vault
        if (logs.length > 0) {
          const lastLog = logs[logs.length - 1]!;
          const newQueue = (lastLog as any).args.newWithdrawQueue as Hex[];
          this.state.vaultWithdrawQueues.set(vault.toLowerCase() as Address, newQueue);
        }
      }
    } catch {
      // Silently ignore — will be picked up on next rebuild
    }
  }

  async getLiquidatablePositions(coveredMarketIds: Hex[]): Promise<{
    liquidatablePositions: AccrualPosition[];
    preLiquidatablePositions: PreLiquidationPosition[];
  }> {
    const coveredMarketSet = new Set(coveredMarketIds);

    // Collect markets and positions with borrowShares > 0 in covered markets
    const marketStates = new Map<Hex, IndexedMarketState>();
    const positionPairs: {
      marketId: Hex;
      user: Address;
      supplyShares: bigint;
      borrowShares: bigint;
      collateral: bigint;
    }[] = [];

    for (const [key, pos] of this.state.positions) {
      if (pos.borrowShares === 0n) continue;

      const separatorIndex = key.indexOf("-", 3); // skip "0x" prefix
      const marketId = key.slice(0, separatorIndex) as Hex;
      const user = key.slice(separatorIndex + 1) as Address;

      if (!coveredMarketSet.has(marketId)) continue;

      const marketState = this.state.markets.get(marketId);
      if (!marketState) continue;

      marketStates.set(marketId, marketState);
      positionPairs.push({
        marketId,
        user,
        supplyShares: pos.supplyShares,
        borrowShares: pos.borrowShares,
        collateral: pos.collateral,
      });
    }

    if (positionPairs.length === 0) {
      return { liquidatablePositions: [], preLiquidatablePositions: [] };
    }

    // Fetch oracle prices (the only RPC call we need)
    const uniqueOracles = [
      ...new Set(
        [...marketStates.values()].map((m) => m.params.oracle).filter((o) => o !== zeroAddress),
      ),
    ];

    const oraclePriceMap = new Map<Address, bigint | undefined>();

    if (uniqueOracles.length > 0) {
      const results = await multicall(this.client, {
        contracts: uniqueOracles.map((oracle) => ({
          address: oracle,
          abi: oracleAbi,
          functionName: "price" as const,
        })),
        allowFailure: true,
      });

      for (let i = 0; i < uniqueOracles.length; i++) {
        const r = results[i]!;
        oraclePriceMap.set(uniqueOracles[i]!, r.status === "success" ? r.result : undefined);
      }
    }

    // Build SDK Market objects from indexed state + oracle prices
    const sdkMarketMap = new Map<Hex, Market>();
    for (const [id, ms] of marketStates) {
      const params = new MarketParams(ms.params);
      const price =
        ms.params.oracle === zeroAddress ? undefined : oraclePriceMap.get(ms.params.oracle);

      sdkMarketMap.set(
        id,
        new Market({
          params,
          totalSupplyAssets: ms.totalSupplyAssets,
          totalBorrowAssets: ms.totalBorrowAssets,
          totalSupplyShares: ms.totalSupplyShares,
          totalBorrowShares: ms.totalBorrowShares,
          lastUpdate: ms.lastUpdate,
          fee: ms.fee,
          price,
          rateAtTarget: ms.rateAtTarget,
        }),
      );
    }

    // Build AccrualPosition objects with interest accrued to now
    const now = Time.timestamp();
    const allPositions = positionPairs.map(
      ({ marketId, user, supplyShares, borrowShares, collateral }) => {
        const market = sdkMarketMap.get(marketId)!;
        const accrualPos = new AccrualPosition(
          { user, supplyShares, borrowShares, collateral },
          market,
        );
        return accrualPos.accrueInterest(now);
      },
    );

    const liquidatablePositions = allPositions.filter(
      (p) => p.seizableCollateral !== undefined && p.seizableCollateral !== 0n,
    );

    // Handle pre-liquidation
    const preLiqContracts = this.state.preLiquidationContracts.filter((c) =>
      coveredMarketSet.has(c.marketId),
    );

    const preLiquidatablePositions = await this.getPreLiquidatablePositions(
      preLiqContracts,
      allPositions,
    );

    return { liquidatablePositions, preLiquidatablePositions };
  }

  private async getPreLiquidatablePositions(
    preLiqContracts: typeof this.state.preLiquidationContracts,
    positions: AccrualPosition[],
  ): Promise<PreLiquidationPosition[]> {
    // Find positions that have a matching pre-liquidation contract and are authorized
    const positionsWithPreLiq = positions
      .map((position) => {
        const contract = preLiqContracts.find((c) => c.marketId === position.marketId);
        if (!contract) return null;

        // Check authorization from indexed state (no RPC needed)
        const isAuthorized =
          this.state.authorizations.get(authorizationKey(position.user, contract.address)) ?? false;
        if (!isAuthorized) return null;

        return { position, contract };
      })
      .filter((e): e is NonNullable<typeof e> => e !== null);

    if (positionsWithPreLiq.length === 0) return [];

    // Collect unique pre-liq oracles that differ from the market oracle
    const uniquePreLiqOracles = new Map<Address, number>();
    const oracleCalls: Address[] = [];

    for (const { position, contract } of positionsWithPreLiq) {
      const preLiqOracle = contract.preLiquidationParams.preLiquidationOracle;
      if (
        preLiqOracle !== position.market.params.oracle &&
        !uniquePreLiqOracles.has(preLiqOracle)
      ) {
        uniquePreLiqOracles.set(preLiqOracle, oracleCalls.length);
        oracleCalls.push(preLiqOracle);
      }
    }

    // Fetch pre-liq oracle prices
    const preLiqOraclePriceMap = new Map<Address, bigint | undefined>();
    if (oracleCalls.length > 0) {
      const results = await multicall(this.client, {
        contracts: oracleCalls.map((oracle) => ({
          address: oracle,
          abi: oracleAbi,
          functionName: "price" as const,
        })),
        allowFailure: true,
      });
      for (const [oracle, idx] of uniquePreLiqOracles) {
        const r = results[idx]!;
        preLiqOraclePriceMap.set(oracle, r.status === "success" ? r.result : undefined);
      }
    }

    // Build PreLiquidationPosition objects
    const result: PreLiquidationPosition[] = [];
    for (const { position, contract } of positionsWithPreLiq) {
      const preLiqOracle = contract.preLiquidationParams.preLiquidationOracle;
      const preLiquidationOraclePrice =
        preLiqOracle === position.market.params.oracle
          ? position.market.price
          : preLiqOraclePriceMap.get(preLiqOracle);

      const preLiqPos = new PreLiquidationPosition(
        {
          preLiquidationParams: contract.preLiquidationParams,
          preLiquidation: contract.address,
          preLiquidationOraclePrice: preLiquidationOraclePrice,
          ...position,
        },
        position.market,
      );

      if (preLiqPos.seizableCollateral !== undefined && preLiqPos.seizableCollateral !== 0n) {
        result.push(preLiqPos);
      }
    }

    return result;
  }

  getMarketsForVaults(vaults: Address[]): Hex[] {
    const marketIds = new Set<Hex>();
    for (const vault of vaults) {
      const queue = this.state.vaultWithdrawQueues.get(vault.toLowerCase() as Address);
      if (queue) {
        for (const id of queue) marketIds.add(id);
      }
    }
    return [...marketIds];
  }
}
