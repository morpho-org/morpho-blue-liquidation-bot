import { GraphQLClient } from "graphql-request";

import { MorphoApiDataProvider } from "../morphoApi";
import { getSdk, type Sdk } from "../morphoApi/api/sdk";

function buildAppMorphoApiSdk(): Sdk {
  const endpoint = process.env.MORPHO_APP_API_GRAPHQL_URL ?? "https://app.api.morpho.org/graphql";
  const apiKey = process.env.MORPHO_APP_API_KEY;
  const apiKeyHeader = process.env.MORPHO_APP_API_KEY_HEADER ?? "x-api-key";

  if (!apiKey) {
    throw new Error("MORPHO_APP_API_KEY is required when using appMorphoApi");
  }

  return getSdk(
    new GraphQLClient(endpoint, {
      headers: {
        "Content-Type": "application/json",
        [apiKeyHeader]: apiKey,
      },
    }),
  );
}

export class AppMorphoApiDataProvider extends MorphoApiDataProvider {
  constructor() {
    super(buildAppMorphoApiSdk());
  }
}
