import { Hono } from "hono";
import { and, client, desc, eq, graphql, replaceBigInts } from "ponder";
import { db, publicClients } from "ponder:api";
import schema from "ponder:schema";
import { zeroAddress, type Address, type Hex } from "viem";

import { oracleAbi } from "../../abis/Oracle";

import { accrueInterest, getLiquidationData, getPreLiquidationData } from "./helpers";
import type { LiquidatablePosition, PreLiquidatablePosition } from "./types";

const app = new Hono();

app.use("/", graphql({ db, schema }));
app.use("/graphql", graphql({ db, schema }));
app.use("/sql/*", client({ db, schema }));

app.get("/chain/:id/vault/:address", async (c) => {
  const { id: chainId, address } = c.req.param();

  const vault = await db.query.vault.findFirst({
    where: (row) => and(eq(row.chainId, Number(chainId)), eq(row.address, address as Address)),
  });

  return c.json(vault?.withdrawQueue);
});

app.post("/chain/:id/liquidatable-positions", async (c) => {
  const { id: chainId } = c.req.param();
  const { marketIds }: { marketIds: Hex[] } = await c.req.json();

  const eligiblePositions = await Promise.all(
    marketIds.map((marketId) => getLiquidatablePositions(Number(chainId), marketId)),
  );

  const liquidatablePositions: LiquidatablePosition[] = [];
  const preLiquidatablePositions: PreLiquidatablePosition[] = [];

  for (const positions of eligiblePositions) {
    liquidatablePositions.push(...positions.liquidatablePositions);
    preLiquidatablePositions.push(...positions.preLiquidatablePositions);
  }

  return c.json({ liquidatablePositions, preLiquidatablePositions });
});

async function getLiquidatablePositions(chainId: number, marketId: Hex) {
  const market = await db.query.market.findFirst({
    where: (row) => and(eq(row.chainId, Number(chainId)), eq(row.id, marketId)),
    with: { positions: true },
  });

  if (!market || market.oracle === zeroAddress)
    return { liquidatablePositions: [], preLiquidatablePositions: [] };

  const { oracle, lltv, loanToken, collateralToken, irm } = market;

  const { totalBorrowAssets, totalBorrowShares } = accrueInterest(
    market,
    market.rateAtTarget,
    BigInt(Math.round(Date.now() / 1000)),
  );

  const publicClient = publicClients[chainId];
  if (!publicClient) return { liquidatablePositions: [], preLiquidatablePositions: [] };

  const collateralPrice = await publicClient.readContract({
    address: oracle,
    abi: oracleAbi,
    functionName: "price",
  });

  const preLiquidations = await db.query.preLiquidation.findMany({
    where: (row) => and(eq(row.chainId, Number(chainId)), eq(row.marketId, marketId)),
  });

  const preLiquidationsData = await Promise.all(
    preLiquidations.map(async (preLiquidation) => ({
      address: preLiquidation.address,
      params: {
        preLltv: preLiquidation.preLltv,
        preLCF1: preLiquidation.preLCF1,
        preLCF2: preLiquidation.preLCF2,
        preLIF1: preLiquidation.preLIF1,
        preLIF2: preLiquidation.preLIF2,
        preLiquidationOracle: preLiquidation.preLiquidationOracle,
      },
      price:
        // To avoid extra calls to the oracle
        preLiquidation.preLiquidationOracle === market.oracle
          ? collateralPrice
          : await publicClient.readContract({
              address: preLiquidation.preLiquidationOracle,
              abi: oracleAbi,
              functionName: "price",
            }),
    })),
  );

  const liquidatablePositions: LiquidatablePosition[] = [];
  const preLiquidatablePositions: PreLiquidatablePosition[] = [];

  await Promise.all(
    market.positions.map(async (position) => {
      const liquidationData = getLiquidationData(
        position.collateral,
        position.borrowShares,
        totalBorrowShares,
        totalBorrowAssets,
        lltv,
        collateralPrice,
      );

      if (liquidationData.seizableCollateral !== 0n && liquidationData.repayableAssets !== 0n) {
        liquidatablePositions.push({
          position: {
            ...position,
            supplyShares: position.supplyShares.toString(),
            borrowShares: position.borrowShares.toString(),
            collateral: position.collateral.toString(),
          },
          marketParams: {
            loanToken,
            collateralToken,
            irm,
            oracle,
            lltv: lltv.toString(),
          },
          seizableCollateral: liquidationData.seizableCollateral.toString(),
          repayableAssets: liquidationData.repayableAssets.toString(),
        });
        return;
      }

      // TODO:
      // - JS `filter` does not accept promises; nothing is being filtered out here.
      // - db queries are currently scaling linearly with both market count and position count,
      //   which is far from optimal.
      const enabledPreLiquidations = await Promise.all(
        preLiquidationsData.filter(async (preLiquidation) => {
          const authorization = await db
            .select()
            .from(schema.authorization)
            .where(
              and(
                eq(schema.authorization.chainId, Number(chainId)),
                eq(schema.authorization.authorizer, position.user),
                eq(schema.authorization.authorized, preLiquidation.address),
              ),
            );

          return authorization[0]?.isAuthorized ?? false;
        }),
      );

      const preLiquidations = enabledPreLiquidations
        .map((preLiquidation) => {
          const preLiquidationData = getPreLiquidationData(
            position.collateral,
            position.borrowShares,
            totalBorrowShares,
            totalBorrowAssets,
            lltv,
            preLiquidation.params,
            preLiquidation.price,
          );

          return {
            preLiquidation,
            ...preLiquidationData,
          };
        })
        .filter(
          (preLiquidation) =>
            preLiquidation.seizableCollateral !== 0n && preLiquidation.repayableAssets !== 0n,
        );

      if (preLiquidations.length > 0) {
        const biggestPreLiquidation = preLiquidations.reduce((a, b) =>
          a.seizableCollateral > b.seizableCollateral ? a : b,
        );

        preLiquidatablePositions.push({
          position: {
            ...position,
            supplyShares: position.supplyShares.toString(),
            borrowShares: position.borrowShares.toString(),
            collateral: position.collateral.toString(),
          },
          marketParams: {
            loanToken,
            collateralToken,
            irm,
            oracle,
            lltv: lltv.toString(),
          },
          seizableCollateral: biggestPreLiquidation.seizableCollateral.toString(),
          repayableAssets: biggestPreLiquidation.repayableAssets.toString(),
          preLiquidation: replaceBigInts(biggestPreLiquidation.preLiquidation, (x) => String(x)),
        });
      }
    }),
  );

  return {
    liquidatablePositions,
    preLiquidatablePositions,
  };
}

// E.g https://localhost:42069/chain/57073/market/0x37bc0ae459a3e417b93607dfc1120b2ee51eb294bf53cbf8fa7451d2fcf4ef97/top-positions
app.get("/chain/:id/market/:marketId/top-positions", async (c) => {
  const { id: chainId, marketId } = c.req.param();
  const publicClient = publicClients[chainId];

  // Get the top 5 positions for this market by collateral size
  const result = await db.query.market.findFirst({
    where: (row) => and(eq(row.chainId, Number(chainId)), eq(row.id, marketId as Hex)),
    with: { positions: { orderBy: (row) => desc(row.collateral), limit: 5 } },
  });

  if (!publicClient || !result) {
    return c.json({ error: "Market not found" }, 404);
  }

  const { positions, ...market } = result;

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
      collateralPrice = await publicClient.readContract({
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
      const { seizableCollateral, repayableAssets } = getLiquidationData(
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
