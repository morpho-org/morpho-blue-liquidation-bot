import { Hono } from "hono";
import { and, client, eq, graphql } from "ponder";
import { db, publicClients } from "ponder:api";
import schema from "ponder:schema";
import { zeroAddress, type Address, type Hex } from "viem";

import { oracleAbi } from "../../abis/Oracle";

import { accrueInterest, liquidationValues } from "./helpers";

const app = new Hono();

app.use("/", graphql({ db, schema }));
app.use("/graphql", graphql({ db, schema }));
app.use("/sql/*", client({ db, schema }));

app.get("/chain/:id/vault/:address", async (c) => {
  const { id: chainId, address } = c.req.param();

  const vault = await db
    .select()
    .from(schema.vault)
    .where(
      and(eq(schema.vault.chainId, Number(chainId)), eq(schema.vault.address, address as Address)),
    )
    .limit(1);

  return c.json(vault[0]?.withdrawQueue);
});

app.post("/chain/:id/liquidatable-positions", async (c) => {
  const { id: chainId } = c.req.param();
  const { marketIds }: { marketIds: Hex[] } = await c.req.json();

  const liquidatablePositions = await Promise.all(
    marketIds.map((marketId) => getLiquidatablePositions(Number(chainId), marketId)),
  );

  return c.json({ positions: liquidatablePositions.flat() });
});

async function getLiquidatablePositions(chainId: number, marketId: Hex) {
  const [markets, positions] = await Promise.all([
    db
      .select()
      .from(schema.market)
      .where(and(eq(schema.market.chainId, Number(chainId)), eq(schema.market.id, marketId)))
      .limit(1),
    db
      .select()
      .from(schema.position)
      .where(
        and(eq(schema.position.chainId, Number(chainId)), eq(schema.position.marketId, marketId)),
      ),
  ]);

  const market = markets[0];

  if (!market || market.oracle === zeroAddress) return [];

  if (!Object.keys(publicClients).includes(String(chainId))) return [];

  const { oracle, lltv, loanToken, collateralToken, irm } = market;

  const { totalBorrowAssets, totalBorrowShares } = accrueInterest(
    market,
    market.rateAtTarget,
    BigInt(Math.round(Date.now() / 1000)),
  );

  // biome-ignore lint/style/noNonNullAssertion: Never null
  const collateralPrice = await publicClients[
    chainId as unknown as keyof typeof publicClients
  ]!.readContract({
    address: oracle,
    abi: oracleAbi,
    functionName: "price",
  });

  return positions
    .map((position) => {
      const { seizableCollateral, repayableAssets } = liquidationValues(
        position.collateral,
        position.borrowShares,
        totalBorrowShares,
        totalBorrowAssets,
        lltv,
        collateralPrice,
      );
      return {
        position: {
          ...position,
          supplyShares: `${position.supplyShares}`,
          borrowShares: `${position.borrowShares}`,
          collateral: `${position.collateral}`,
        },
        marketParams: {
          loanToken,
          collateralToken,
          irm,
          oracle,
          lltv: `${lltv}`,
        },
        seizableCollateral: `${seizableCollateral}`,
        repayableAssets: `${repayableAssets}`,
      };
    })
    .filter(
      (position) =>
        BigInt(position.seizableCollateral) !== 0n && BigInt(position.repayableAssets) !== 0n,
    );
}

// E.g https://localhost:42069/chain/57073/market/0x37bc0ae459a3e417b93607dfc1120b2ee51eb294bf53cbf8fa7451d2fcf4ef97/top-positions
app.get("/chain/:id/market/:marketId/top-positions", async (c) => {
  const { id: chainId, marketId } = c.req.param();

  // Get the market data first
  const markets = await db
    .select()
    .from(schema.market)
    .where(and(eq(schema.market.chainId, Number(chainId)), eq(schema.market.id, marketId as Hex)))
    .limit(1);

  const market = markets[0];

  if (!market) {
    return c.json({ error: "Market not found" }, 404);
  }

  // Get the top 10 positions for this market by collateral size
  const positions = await db
    .select()
    .from(schema.position)
    .where(
      and(
        eq(schema.position.chainId, Number(chainId)),
        eq(schema.position.marketId, marketId as Hex),
      ),
    )
    .limit(5); // Get top 5 positions

  // Calculate additional information for each position if needed
  const { totalBorrowAssets, totalBorrowShares } = accrueInterest(
    market,
    market.rateAtTarget,
    BigInt(Math.round(Date.now() / 1000)),
  );

  // Get the collateral price if oracle is available
  let collateralPrice = 0n;
  if (market.oracle !== zeroAddress && Object.keys(publicClients).includes(String(chainId))) {
    try {
      // biome-ignore lint/style/noNonNullAssertion: Never null
      collateralPrice = await publicClients[
        chainId as unknown as keyof typeof publicClients
      ]!.readContract({
        address: market.oracle,
        abi: oracleAbi,
        functionName: "price",
      });
    } catch (error) {
      console.error("Failed to get collateral price:", error);
    }
  }

  // Enhance the positions with additional calculated data
  const enhancedPositions = positions.map((position) => {
    // Calculate position metrics like health factor, etc.
    const borrowedAssets =
      position.borrowShares === 0n
        ? 0n
        : (position.borrowShares * totalBorrowAssets) / totalBorrowShares;

    const collateralValueInLoanToken =
      collateralPrice !== 0n ? (position.collateral * collateralPrice) / 10n ** 18n : 0n;

    // Calculate health factor (if borrowing)
    const healthFactor =
      borrowedAssets === 0n
        ? "∞" // Infinity symbol for positions with no borrows
        : ((collateralValueInLoanToken * market.lltv) / (borrowedAssets * 10n ** 18n)).toString();

    // Calculate liquidation metrics if applicable
    let liquidationData = {};
    if (borrowedAssets > 0n && collateralPrice > 0n) {
      const { seizableCollateral, repayableAssets } = liquidationValues(
        position.collateral,
        position.borrowShares,
        totalBorrowShares,
        totalBorrowAssets,
        market.lltv,
        collateralPrice,
      );

      liquidationData = {
        seizableCollateral: seizableCollateral.toString(),
        repayableAssets: repayableAssets.toString(),
        isLiquidatable: seizableCollateral !== 0n && repayableAssets !== 0n,
      };
    }

    return {
      user: position.user,
      collateral: position.collateral.toString(),
      collateralValueInLoanToken: collateralValueInLoanToken.toString(),
      supplyShares: position.supplyShares.toString(),
      borrowShares: position.borrowShares.toString(),
      borrowedAssets: borrowedAssets.toString(),
      healthFactor,
      ...liquidationData,
    };
  });

  return c.json({
    market: {
      id: market.id,
      loanToken: market.loanToken,
      collateralToken: market.collateralToken,
      totalSupplyAssets: market.totalSupplyAssets.toString(),
      totalBorrowAssets: totalBorrowAssets.toString(),
      lltv: market.lltv.toString(),
      lastUpdate: market.lastUpdate.toString(),
    },
    positions: enhancedPositions,
    timestamp: Math.round(Date.now() / 1000),
  });
});

export default app;
