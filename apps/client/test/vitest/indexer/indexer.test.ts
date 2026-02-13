import { getChainAddresses } from "@morpho-org/blue-sdk";
import { adaptiveCurveIrmAbi } from "@morpho-org/blue-sdk-viem";
import { zeroAddress, type Address, type Hex } from "viem";
import { multicall } from "viem/actions";
import { describe, expect } from "vitest";

import { morphoBlueAbi } from "../../../src/abis/morpho/morphoBlue";
import { createEmptyState } from "../../../src/indexer/state";
import { syncRange, type SyncConfig } from "../../../src/indexer/sync";
import { indexerTest } from "../../../test/setup";

const MORPHO_ADDRESS = "0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb" as Address;
const START_BLOCK = 18_883_124n;

describe("Indexer", () => {
  indexerTest.sequential(
    "should index markets matching on-chain state",
    async ({ client }) => {
      const chainAddresses = getChainAddresses(1);

      const config: SyncConfig = {
        client: client as any,
        addresses: {
          morpho: MORPHO_ADDRESS,
          adaptiveCurveIrm: chainAddresses.adaptiveCurveIrm,
          preLiquidationFactory: chainAddresses.preLiquidationFactory,
          vaults: [],
        },
      };

      const state = createEmptyState();
      const toBlock = await client.getBlockNumber();
      await syncRange(config, state, START_BLOCK, toBlock);

      // We should have indexed some markets
      expect(state.markets.size).toBeGreaterThan(0);
      console.log(`Indexed ${state.markets.size} markets`);

      // Compare every indexed market against on-chain state
      const marketIds = [...state.markets.keys()];
      const BATCH = 50;
      for (let i = 0; i < marketIds.length; i += BATCH) {
        const batch = marketIds.slice(i, i + BATCH);
        const results = await multicall(client as any, {
          contracts: batch.map((id) => ({
            address: MORPHO_ADDRESS,
            abi: morphoBlueAbi,
            functionName: "market" as const,
            args: [id],
          })),
          allowFailure: false,
        });

        for (let j = 0; j < batch.length; j++) {
          const id = batch[j]!;
          const indexed = state.markets.get(id)!;
          const onchain = results[j]! as [bigint, bigint, bigint, bigint, bigint, bigint];

          expect(indexed.totalSupplyAssets).toEqual(onchain[0]);
          expect(indexed.totalSupplyShares).toEqual(onchain[1]);
          expect(indexed.totalBorrowAssets).toEqual(onchain[2]);
          expect(indexed.totalBorrowShares).toEqual(onchain[3]);
          // lastUpdate: only check for markets with irm != zeroAddress
          if (indexed.params.irm !== zeroAddress) {
            expect(indexed.lastUpdate).toEqual(onchain[4]);
          }
          expect(indexed.fee).toEqual(onchain[5]);
        }
      }
    },
    { timeout: 600_000 },
  );

  indexerTest.sequential(
    "should index positions matching on-chain state",
    async ({ client }) => {
      const chainAddresses = getChainAddresses(1);

      const config: SyncConfig = {
        client: client as any,
        addresses: {
          morpho: MORPHO_ADDRESS,
          adaptiveCurveIrm: chainAddresses.adaptiveCurveIrm,
          preLiquidationFactory: chainAddresses.preLiquidationFactory,
          vaults: [],
        },
      };

      const state = createEmptyState();
      const toBlock = await client.getBlockNumber();
      await syncRange(config, state, START_BLOCK, toBlock);

      // Filter positions with non-zero values
      const nonZeroPositions = [...state.positions.entries()].filter(
        ([, pos]) => pos.supplyShares !== 0n || pos.borrowShares !== 0n || pos.collateral !== 0n,
      );
      expect(nonZeroPositions.length).toBeGreaterThan(0);
      console.log(
        `Indexed ${nonZeroPositions.length} non-zero positions (out of ${state.positions.size} total)`,
      );

      // Sample up to 50 random non-zero positions and compare against on-chain state
      const sampleSize = Math.min(50, nonZeroPositions.length);
      const sampled = shuffle(nonZeroPositions).slice(0, sampleSize);

      const positionCalls = sampled.map(([key]) => {
        const separatorIndex = key.indexOf("-", 3);
        const marketId = key.slice(0, separatorIndex) as Hex;
        const user = key.slice(separatorIndex + 1) as Address;
        return {
          address: MORPHO_ADDRESS,
          abi: morphoBlueAbi,
          functionName: "position" as const,
          args: [marketId, user] as [Hex, Address],
        };
      });

      const results = await multicall(client as any, {
        contracts: positionCalls,
        allowFailure: false,
      });

      for (let i = 0; i < sampled.length; i++) {
        const [key, indexed] = sampled[i]!;
        const onchain = results[i]! as [bigint, bigint, bigint];

        expect(indexed.supplyShares, `supplyShares mismatch for ${key}`).toEqual(onchain[0]);
        expect(indexed.borrowShares, `borrowShares mismatch for ${key}`).toEqual(onchain[1]);
        expect(indexed.collateral, `collateral mismatch for ${key}`).toEqual(onchain[2]);
      }
    },
    { timeout: 600_000 },
  );

  indexerTest.sequential(
    "should index authorizations matching on-chain state",
    async ({ client }) => {
      const chainAddresses = getChainAddresses(1);

      const config: SyncConfig = {
        client: client as any,
        addresses: {
          morpho: MORPHO_ADDRESS,
          adaptiveCurveIrm: chainAddresses.adaptiveCurveIrm,
          preLiquidationFactory: chainAddresses.preLiquidationFactory,
          vaults: [],
        },
      };

      const state = createEmptyState();
      const toBlock = await client.getBlockNumber();
      await syncRange(config, state, START_BLOCK, toBlock);

      const authEntries = [...state.authorizations.entries()];
      expect(authEntries.length).toBeGreaterThan(0);
      console.log(`Indexed ${authEntries.length} authorizations`);

      // Sample up to 50 authorizations and compare on-chain
      const sampleSize = Math.min(50, authEntries.length);
      const sampled = shuffle(authEntries).slice(0, sampleSize);

      const authCalls = sampled.map(([key]) => {
        const [authorizer, authorizee] = key.split("-") as [Address, Address];
        return {
          address: MORPHO_ADDRESS,
          abi: morphoBlueAbi,
          functionName: "isAuthorized" as const,
          args: [authorizer, authorizee] as [Address, Address],
        };
      });

      const results = await multicall(client as any, {
        contracts: authCalls,
        allowFailure: false,
      });

      for (let i = 0; i < sampled.length; i++) {
        const [key, indexed] = sampled[i]!;
        const onchain = results[i]!;
        expect(indexed, `authorization mismatch for ${key}`).toEqual(onchain);
      }
    },
    { timeout: 600_000 },
  );

  indexerTest.sequential(
    "should index rateAtTarget matching on-chain state",
    async ({ client }) => {
      const chainAddresses = getChainAddresses(1);

      const config: SyncConfig = {
        client: client as any,
        addresses: {
          morpho: MORPHO_ADDRESS,
          adaptiveCurveIrm: chainAddresses.adaptiveCurveIrm,
          preLiquidationFactory: chainAddresses.preLiquidationFactory,
          vaults: [],
        },
      };

      const state = createEmptyState();
      const toBlock = await client.getBlockNumber();
      await syncRange(config, state, START_BLOCK, toBlock);

      // Filter markets that use the adaptive curve IRM and have a rateAtTarget
      const adaptiveMarkets = [...state.markets.entries()].filter(
        ([, m]) =>
          m.params.irm.toLowerCase() === chainAddresses.adaptiveCurveIrm.toLowerCase() &&
          m.rateAtTarget !== undefined,
      );

      expect(adaptiveMarkets.length).toBeGreaterThan(0);
      console.log(`Indexed ${adaptiveMarkets.length} markets with rateAtTarget`);

      // Compare all rateAtTarget values on-chain
      const BATCH = 50;
      for (let i = 0; i < adaptiveMarkets.length; i += BATCH) {
        const batch = adaptiveMarkets.slice(i, i + BATCH);
        const results = await multicall(client as any, {
          contracts: batch.map(([id]) => ({
            address: chainAddresses.adaptiveCurveIrm,
            abi: adaptiveCurveIrmAbi,
            functionName: "rateAtTarget" as const,
            args: [id],
          })),
          allowFailure: false,
        });

        for (let j = 0; j < batch.length; j++) {
          const [id, indexed] = batch[j]!;
          const onchain = results[j]!;
          expect(indexed.rateAtTarget, `rateAtTarget mismatch for market ${id}`).toEqual(onchain);
        }
      }
    },
    { timeout: 600_000 },
  );
});

function shuffle<T>(array: T[]): T[] {
  const a = [...array];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}
