import { GraphQLClient } from "graphql-request";

import { MorphoApiDataProvider } from "../morphoApi";
import { getSdk, type Sdk } from "../morphoApi/api/sdk";

function buildAppMorphoApiSdk(): Sdk {
  const endpoint = process.env.MORPHO_APP_API_GRAPHQL_URL ?? "https://app.api.morpho.org/graphql";
  const apiKey = process.env.MORPHO_APP_API_KEY;
  const customHeader = process.env.MORPHO_APP_API_KEY_HEADER;

  if (!apiKey) {
    throw new Error("MORPHO_APP_API_KEY is required when using appMorphoApi");
  }

  // Default to RFC-6750 Bearer auth (what app.api.morpho.org expects). If the
  // operator sets MORPHO_APP_API_KEY_HEADER explicitly, send the raw key under
  // that header instead — useful if the upstream API ever switches schemes.
  const authHeaders: Record<string, string> = customHeader
    ? { [customHeader]: apiKey }
    : { authorization: `Bearer ${apiKey}` };

  return getSdk(
    new GraphQLClient(endpoint, {
      headers: {
        "Content-Type": "application/json",
        // CloudFront WAF in front of app.api.morpho.org rejects requests with
        // the default Node fetch User-Agent. Set an explicit one.
        "User-Agent": "morpho-blue-liquidation-bot",
        ...authHeaders,
      },
    }),
  );
}

export class AppMorphoApiDataProvider extends MorphoApiDataProvider {
  constructor() {
    super(buildAppMorphoApiSdk());
  }
}
