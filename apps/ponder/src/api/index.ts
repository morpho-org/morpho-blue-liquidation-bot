import { Hono } from "hono";
import { and, client, eq, graphql } from "ponder";
import { db } from "ponder:api";
import schema from "ponder:schema";
import type { Address } from "viem";

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

app.get("/chain/:id/market/:id/state", async (c) => {
  const { id: chainId, id: marketId } = c.req.param();

  const market = await db
    .select()
    .from(schema.market)
    .where(
      and(eq(schema.market.chainId, Number(chainId)), eq(schema.market.id, marketId as Address)),
    )
    .limit(1);

  return c.json(market[0]);
});

app.get("/chain/:id/market/:id/positions", async (c) => {
  const { id: chainId, id: marketId } = c.req.param();

  const positions = await db
    .select()
    .from(schema.position)
    .where(
      and(
        eq(schema.position.chainId, Number(chainId)),
        eq(schema.position.marketId, marketId as Address),
      ),
    );

  return c.json(positions);
});

export default app;
