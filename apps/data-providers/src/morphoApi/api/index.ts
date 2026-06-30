import { MORPHO_API_GRAPHQL_URL } from "@morpho-blue-liquidation-bot/config";
import { GraphQLClient } from "graphql-request";

import { getSdk } from "./sdk.js";

export * as ApiTypes from "./types.js";

export const apiSdk: ReturnType<typeof getSdk> = getSdk(new GraphQLClient(MORPHO_API_GRAPHQL_URL));
