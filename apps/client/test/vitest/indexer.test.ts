import { describe, expect } from "vitest";
import { createClient } from "@ponder/client";
import { createPublicClient, http } from "viem";
import { mainnet } from "viem/chains";
import { indexerTest } from "../setup.js";
import * as schema from "../../../ponder/ponder.schema.js";
import { chainConfigs } from "../../config.js";
import { fetchWhiteListedMarketsForVault } from "../../src/utils/fetchers.js";
import { metaMorphoAbi } from "../../../ponder/abis/MetaMorpho.js";
import { morphoBlueAbi } from "../../../ponder/abis/MorphoBlue.js";

describe("Indexing", () => {
  const MORPHO_ADDRESS = "0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb";

  const config = chainConfigs[mainnet.id];
  if (!config) throw new Error("Mainnet config not found");

  const client = createPublicClient({
    chain: mainnet,
    transport: http(config.rpcUrl),
  });
  const ponderClient = createClient("http://localhost:42069/sql", { schema });

  indexerTest.sequential("should test vaults indexing", async () => {
    for (const vault of config.vaultWhitelist) {
      const indexerWithdrawQueue = await fetchWhiteListedMarketsForVault(mainnet.id, vault);
      const withdrawQueueLength = await client.readContract({
        address: vault,
        abi: metaMorphoAbi,
        functionName: "withdrawQueueLength",
      });

      expect(Number(withdrawQueueLength)).toBe(indexerWithdrawQueue.length);

      const withdrawQueue = await Promise.all(
        Array.from({ length: indexerWithdrawQueue.length }, (_, i) => i).map((i) =>
          client.readContract({
            address: vault,
            abi: metaMorphoAbi,
            functionName: "withdrawQueue",
            args: [BigInt(i)],
          }),
        ),
      );

      for (const whitelistedMarket of indexerWithdrawQueue) {
        expect(withdrawQueue.includes(whitelistedMarket)).toBe(true);
      }
    }
  });

  indexerTest.sequential("should test markets indexing", async () => {
    const markets = await ponderClient.db.select().from(schema.market).limit(100);
    const count = markets.length;

    for (let i = 0; i < 10; i++) {
      const randomIndex = Math.floor(Math.random() * count);
      const randomMarket = markets[randomIndex]!;

      const onchainMarket = await client.readContract({
        address: MORPHO_ADDRESS,
        abi: morphoBlueAbi,
        functionName: "market",
        args: [randomMarket.id],
      });

      expect(randomMarket.totalSupplyAssets).toEqual(onchainMarket[0]);
      expect(randomMarket.totalSupplyShares).toEqual(onchainMarket[1]);
      expect(randomMarket.totalBorrowAssets).toEqual(onchainMarket[2]);
      expect(randomMarket.totalBorrowShares).toEqual(onchainMarket[3]);
      expect(randomMarket.lastUpdate).toEqual(onchainMarket[4]);
      expect(randomMarket.fee).toEqual(onchainMarket[5]);
    }
  });

  indexerTest.sequential("should test positions indexing", async () => {
    const positions = await ponderClient.db.select().from(schema.position).limit(100);
    const count = positions.length;

    for (let i = 0; i < 10; i++) {
      const randomIndex = Math.floor(Math.random() * count);
      const randomPosition = positions[randomIndex]!;

      const onchainPosition = await client.readContract({
        address: MORPHO_ADDRESS,
        abi: morphoBlueAbi,
        functionName: "position",
        args: [randomPosition.marketId, randomPosition.user],
      });

      expect(randomPosition.supplyShares).toEqual(onchainPosition[0]);
      expect(randomPosition.borrowShares).toEqual(onchainPosition[1]);
      expect(randomPosition.collateral).toEqual(onchainPosition[2]);
    }
  });
});
