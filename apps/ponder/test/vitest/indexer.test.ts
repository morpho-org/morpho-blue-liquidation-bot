import { describe, expect } from "vitest";
import { createClient } from "@ponder/client";
import { indexingTest } from "../setup";
import * as schema from "../../ponder.schema.js";
import { metaMorphoAbi } from "../../abis/MetaMorpho.js";
import { morphoBlueAbi } from "../../abis/MorphoBlue.js";
import { zeroAddress } from "viem";
import { MORPHO } from "../../../client/test/constants.js";

describe("Indexing", () => {
  const ponderClient = createClient("http://localhost:42069/sql", { schema });

  indexingTest.sequential("should test vaults indexing", async ({ client }) => {
    const vaults = await ponderClient.db.select().from(schema.vault).limit(10);
    const count = vaults.length;

    const randomIndex = Math.floor(Math.random() * count);
    const randomVault = vaults[randomIndex]!;

    for (let i = 0; i < randomVault.withdrawQueue.length; i++) {
      const expectedMarket = await client.readContract({
        address: randomVault.address,
        abi: metaMorphoAbi,
        functionName: "withdrawQueue",
        args: [BigInt(i)],
      });

      expect(expectedMarket).toBe(randomVault.withdrawQueue[i]);
    }
  });

  indexingTest.sequential("should test markets indexing", async ({ client }) => {
    const markets = await ponderClient.db.select().from(schema.market).limit(100);
    const count = markets.length;

    for (let i = 0; i < 5; i++) {
      const randomIndex = Math.floor(Math.random() * count);
      const randomMarket = markets[randomIndex]!;

      const onchainMarket = await client.readContract({
        address: MORPHO,
        abi: morphoBlueAbi,
        functionName: "market",
        args: [randomMarket.id],
      });

      expect(randomMarket.totalSupplyAssets).toEqual(onchainMarket[0]);
      expect(randomMarket.totalSupplyShares).toEqual(onchainMarket[1]);
      expect(randomMarket.totalBorrowAssets).toEqual(onchainMarket[2]);
      expect(randomMarket.totalBorrowShares).toEqual(onchainMarket[3]);
      expect(randomMarket.fee).toEqual(onchainMarket[5]);
      if (randomMarket.irm !== zeroAddress)
        expect(randomMarket.lastUpdate).toEqual(onchainMarket[4]);
    }
  });

  indexingTest.sequential("should test positions indexing", async ({ client }) => {
    const positions = await ponderClient.db.select().from(schema.position).limit(100);
    const count = positions.length;

    for (let i = 0; i < 10; i++) {
      const randomIndex = Math.floor(Math.random() * count);
      const randomPosition = positions[randomIndex]!;

      const onchainPosition = await client.readContract({
        address: MORPHO,
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
