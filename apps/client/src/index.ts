import { createClient } from "@ponder/client";

import * as schema from "../../ponder/ponder.schema.js";

const client = createClient("http://localhost:42069/sql", { schema });

const result = await client.db.select().from(schema.vault).limit(10);

console.log(result);
