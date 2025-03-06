import { Hono } from "hono";
import { client, graphql } from "ponder";
import { db } from "ponder:api";
import schema from "ponder:schema";

const app = new Hono();

app.use("/", graphql({ db, schema }));
app.use("/graphql", graphql({ db, schema }));
app.use("/sql/*", client({ db, schema }));

export default app;
