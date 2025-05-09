import type { Client } from "viem";

import type { Asset } from "../../utils/types";
import type { Pricer } from "../pricer";

export class MorphoApi implements Pricer {
  private readonly API_URL = "https://blue-api.morpho.org/graphql";
  private supportedChains: number[] = [];
  private initialized = false;

  async supportsChain(chainId: number) {
    if (!this.initialized) {
      const initilizationQuery = `
      query {
        chains{
            id
        }
      }
      `;

      const response = await fetch(this.API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: initilizationQuery }),
      });

      const data = (await response.json()) as { data: { chains: { id: number }[] } };
      this.supportedChains = data.data.chains.map((chain) => chain.id);
      this.initialized = true;
    }

    return this.supportedChains.includes(chainId);
  }

  async toUsd(client: Client, asset: Asset, amount: bigint) {
    const response = await fetch(this.API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // biome-ignore lint/style/noNonNullAssertion: never null
      body: JSON.stringify({ query: this.query(client.chain!.id, asset) }),
    });
    const data = (await response.json()) as { data: { assets: { items: { priceUsd: number }[] } } };
    const items = data.data.assets.items;

    const priceUsd = items[0]?.priceUsd ?? null;

    if (priceUsd === null) return undefined;

    return priceUsd * (Number(amount) / 10 ** asset.decimals);
  }

  private query(chainId: number, asset: Asset) {
    return `
    query {
        assets(where: { address_in: ["${asset.address}"], chainId_in: [${chainId}]} ) {
            items {
                priceUsd
            }
        }
    }
    `;
  }
}
