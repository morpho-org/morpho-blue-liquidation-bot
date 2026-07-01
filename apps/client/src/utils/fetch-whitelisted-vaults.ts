import { type Address } from "viem";

const QUERY = `
  query ExampleQuery($chainIds: [Int!]!) {
    vaults(where: { chainId_in: $chainIds, listed: true }) {
      items {
        address
        chain {
          id
        }
      }
    }
  }
`;

interface VaultsResponse {
  data: {
    vaults: {
      items: { address: Address }[];
    };
  };
  errors?: { message: string }[];
}

export type VaultWhitelistSource = "morpho-api" | "app-morpho-api";

/**
 * Fetches the vaults listed on the Morpho API for the given chain.
 *
 * - `"morpho-api"` (default): public `blue-api.morpho.org`, no auth.
 * - `"app-morpho-api"`: private `app.api.morpho.org`, Bearer auth via
 *   `MORPHO_APP_API_KEY`. Used for chains that the public API does not index.
 *   Endpoint / header / key names can be overridden with the same env vars
 *   that drive `AppMorphoApiDataProvider`.
 */
export async function fetchWhitelistedVaults(
  chainId: number,
  source: VaultWhitelistSource = "morpho-api",
): Promise<Address[]> {
  const { endpoint, headers } = buildRequestConfig(source);

  const res = await fetch(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify({ query: QUERY, variables: { chainIds: [chainId] } }),
  });

  const json = (await res.json()) as VaultsResponse;

  if (json.errors?.length) {
    console.warn(json.errors.map((e) => e.message).join("\n"));
    return [];
  }

  return json.data.vaults.items.map((item) => item.address);
}

function buildRequestConfig(source: VaultWhitelistSource): {
  endpoint: string;
  headers: Record<string, string>;
} {
  if (source === "morpho-api") {
    return {
      endpoint: "https://blue-api.morpho.org/graphql",
      headers: { "Content-Type": "application/json" },
    };
  }

  const endpoint = process.env.MORPHO_APP_API_GRAPHQL_URL ?? "https://app.api.morpho.org/graphql";
  const apiKey = process.env.MORPHO_APP_API_KEY;
  const customHeader = process.env.MORPHO_APP_API_KEY_HEADER;

  if (!apiKey) {
    throw new Error('MORPHO_APP_API_KEY is required when vaultWhitelist is "app-morpho-api"');
  }

  // Default to RFC-6750 Bearer auth (what app.api.morpho.org expects).
  // MORPHO_APP_API_KEY_HEADER lets an operator swap in a raw-key header if the
  // upstream scheme ever changes. CloudFront's WAF in front of the app endpoint
  // rejects requests with the default Node fetch User-Agent — set one.
  const authHeaders: Record<string, string> = customHeader
    ? { [customHeader]: apiKey }
    : { authorization: `Bearer ${apiKey}` };

  return {
    endpoint,
    headers: {
      "Content-Type": "application/json",
      "User-Agent": "morpho-blue-liquidation-bot",
      ...authHeaders,
    },
  };
}
