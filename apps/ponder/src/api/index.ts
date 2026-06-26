import { Hono } from "hono";
import { and, client, eq, graphql, inArray, replaceBigInts as replaceBigIntsBase } from "ponder";
import { db, publicClients } from "ponder:api";
import schema from "ponder:schema";
import type { Address, Hex } from "viem";

import { getLiquidatablePositions } from "./liquidatable-positions";

function replaceBigInts<T>(value: T) {
  return replaceBigIntsBase(value, (x) => `${String(x)}n`);
}

const app = new Hono();

app.use("/", graphql({ db, schema }));
app.use("/graphql", graphql({ db, schema }));
app.use("/sql/*", client({ db, schema }));

app.post("/chain/:id/withdraw-queue/:address", async (c) => {
  const { id: chainId, address } = c.req.param();

  const vault = await db.query.vault.findFirst({
    where: (row) => and(eq(row.chainId, Number(chainId)), eq(row.address, address as Address)),
  });

  return c.json(vault?.withdrawQueue ?? []);
});

/**
 * Fetch the set of markets from all vaults' withdraw queues.
 */
app.post("/chain/:chainId/withdraw-queue-set", async (c) => {
  const { chainId } = c.req.param();
  const { vaults: vaultsRaw } = (await c.req.json()) as unknown as { vaults: Address[] };

  const vaults = await db.query.vault.findMany({
    where: (row) => and(eq(row.chainId, Number(chainId)), inArray(row.address, vaultsRaw)),
  });

  const withdrawQueueSet = new Set(vaults.flatMap((item) => item.withdrawQueue));

  return c.json(replaceBigInts([...withdrawQueueSet]));
});

/**
 * Fetch all liquidatable (and pre-liquidatable) positions for a given set of markets.
 */
app.post("/chain/:chainId/liquidatable-positions", async (c) => {
  const { chainId: chainIdRaw } = c.req.param();
  const { marketIds: marketIdsRaw } = (await c.req.json()) as unknown as { marketIds: Hex[] };

  if (!Array.isArray(marketIdsRaw)) {
    return c.json({ error: "Request body must include a `marketIds` array." }, 400);
  }

  const chainId = Number.parseInt(chainIdRaw, 10);
  const marketIds = [...new Set(marketIdsRaw)];

  const publicClient = Object.values(publicClients).find(
    (publicClient) => publicClient.chain?.id === chainId,
  );

  if (!publicClient) {
    return c.json(
      {
        error: `${chainIdRaw} is not one of the supported chains: [${Object.keys(publicClients).join(", ")}]`,
      },
      400,
    );
  }

  const response = await getLiquidatablePositions({ db, chainId, publicClient, marketIds });
  return c.json(replaceBigInts(response));
});

export default app;
