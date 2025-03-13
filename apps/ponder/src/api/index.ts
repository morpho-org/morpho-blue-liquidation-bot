import { Hono } from "hono";
import { and, client, eq, graphql } from "ponder";
import { db, publicClients } from "ponder:api";
import schema from "ponder:schema";
import type { Address, Hex } from "viem";

import { oracleAbi } from "../../abis/Oracle";

import { liquidationValues } from "./helpers";

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

  return c.json(liquidatablePositions.flat());
});

async function getLiquidatablePositions(chainId: number, marketId: Hex) {
  const [market, positions] = await Promise.all([
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

  if (!market[0]) return [];

  if (!Object.keys(publicClients).includes(String(chainId))) return [];

  const { totalBorrowAssets, totalBorrowShares, oracle, lltv, loanToken, collateralToken, irm } =
    market[0];

  const collateralPrice = await publicClients[
    chainId as unknown as keyof typeof publicClients
  ].readContract({
    address: oracle,
    abi: oracleAbi,
    functionName: "price",
  });

  return positions
    .map((position) => {
      const { seizableCollateral, repaidAssets } = liquidationValues(
        position.collateral,
        position.borrowShares,
        totalBorrowShares,
        totalBorrowAssets,
        lltv,
        collateralPrice,
      );
      return {
        ...position,
        loanToken,
        collateralToken,
        irm,
        oracle,
        lltv,
        seizableCollateral,
        repaidAssets,
      };
    })
    .filter((position) => position.seizableCollateral !== 0n && position.repaidAssets !== 0n);
}

export default app;
