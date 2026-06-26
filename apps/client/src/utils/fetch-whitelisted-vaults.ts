import { type Address } from "viem";

const QUERY = `
  query ExampleQuery($chainIds: [Int!]!) {
    vaults(where: { chainId_in: $chainIds, whitelisted: true }) {
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

export async function fetchWhitelistedVaults(chainId: number): Promise<Address[]> {
  const res = await fetch("https://blue-api.morpho.org/graphql", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query: QUERY, variables: { chainIds: [chainId] } }),
  });

  const json = (await res.json()) as VaultsResponse;

  if (json.errors?.length) {
    console.warn(json.errors.map((e) => e.message).join("\n"));
    return [];
  }

  return json.data.vaults.items.map((item) => item.address);
}
