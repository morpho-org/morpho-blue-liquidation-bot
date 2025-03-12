import { Hono } from "hono";
import { and, client, eq, graphql } from "ponder";
import { db, publicClients } from "ponder:api";
import schema from "ponder:schema";
import type { Address, Hex } from "viem";

import { oracleAbi } from "../../abis/Oracle";

import { seizableCollateral } from "./helpers";

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

app.get("/chain/:id/market/:id/liquidatable-positions", async (c) => {
  const { id: chainId, id: marketId } = c.req.param();

  const [market, positions] = await Promise.all([
    db
      .select()
      .from(schema.market)
      .where(and(eq(schema.market.chainId, Number(chainId)), eq(schema.market.id, marketId as Hex)))
      .limit(1),
    db
      .select()
      .from(schema.position)
      .where(
        and(
          eq(schema.position.chainId, Number(chainId)),
          eq(schema.position.marketId, marketId as Hex),
        ),
      ),
  ]);

  if (!market[0]) {
    return c.json({ error: "Market not found" }, 404);
  }

  if (!Object.keys(publicClients).includes(chainId)) {
    return c.json({ error: "Chain not supported" }, 404);
  }

  const { totalBorrowAssets, totalBorrowShares, oracle, lltv } = market[0];

  const collateralPrice = await publicClients[
    chainId as unknown as keyof typeof publicClients
  ].readContract({
    address: oracle,
    abi: oracleAbi,
    functionName: "price",
  });

  const liquidatablePositions = positions
    .map((position) => {
      return {
        ...position,
        seizableCollateral: seizableCollateral(
          position.collateral,
          position.borrowShares,
          totalBorrowShares,
          totalBorrowAssets,
          lltv,
          collateralPrice,
        ),
      };
    })
    .filter((position) => position.seizableCollateral !== undefined);

  return c.json(liquidatablePositions);
});

export default app;
