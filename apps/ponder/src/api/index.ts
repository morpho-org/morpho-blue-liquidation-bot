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

  const collateralPrice = await publicClients[
    chainId as unknown as keyof typeof publicClients
  ].readContract({
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
        position.marketId,
        position.user,
      );
      return {
        position: {
          ...position,
          supplyShares: Number(position.supplyShares),
          borrowShares: Number(position.borrowShares),
          collateral: Number(position.collateral),
        },
        marketParams: {
          loanToken,
          collateralToken,
          irm,
          oracle,
          lltv: Number(lltv),
        },
        seizableCollateral,
        repayableAssets,
      };
    })
    .filter((position) => position.seizableCollateral !== 0 && position.repayableAssets !== 0);
}

export default app;
