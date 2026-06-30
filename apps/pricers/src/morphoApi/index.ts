import { MORPHO_API_GRAPHQL_URL } from "@morpho-blue-liquidation-bot/config";
import type { Account, Address, Chain, Client, Transport } from "viem";

import type { Pricer } from "../pricer";

const ASSET_BATCH_SIZE = 30;

interface PendingPriceRequest {
  asset: Address;
  resolve: (price: number | undefined) => void;
}

interface AssetsPriceResponse {
  data?: {
    assets?: {
      items?: {
        address: Address;
        price: { usd: number | null } | null;
      }[];
    };
  };
  errors?: { message: string }[];
}

export class MorphoApi implements Pricer {
  private readonly pendingRequests = new Map<number, PendingPriceRequest[]>();
  private readonly scheduledChains = new Set<number>();

  async price(client: Client<Transport, Chain, Account>, asset: Address) {
    const chainId = client.chain.id;

    return new Promise<number | undefined>((resolve) => {
      const requests = this.pendingRequests.get(chainId) ?? [];
      requests.push({ asset, resolve });
      this.pendingRequests.set(chainId, requests);

      if (!this.scheduledChains.has(chainId)) {
        this.scheduledChains.add(chainId);
        queueMicrotask(() => void this.flush(chainId));
      }
    });
  }

  private async flush(chainId: number) {
    const requests = this.pendingRequests.get(chainId) ?? [];
    this.pendingRequests.delete(chainId);
    this.scheduledChains.delete(chainId);

    if (requests.length === 0) return;

    const uniqueAssets = [
      ...new Map(requests.map((request) => [this.key(request.asset), request.asset])).values(),
    ];
    const prices = await this.fetchPrices(chainId, uniqueAssets);

    for (const request of requests) {
      request.resolve(prices.get(this.key(request.asset)));
    }
  }

  private async fetchPrices(chainId: number, assets: Address[]) {
    const prices = new Map<string, number>();
    const chunks = this.chunk(assets, ASSET_BATCH_SIZE);

    await Promise.all(
      chunks.map(async (chunk) => {
        try {
          const response = await fetch(MORPHO_API_GRAPHQL_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              query: this.query(),
              variables: { chainId, addresses: chunk, first: ASSET_BATCH_SIZE },
            }),
          });

          if (!response.ok) return;

          const data = (await response.json()) as AssetsPriceResponse;

          if (data.errors?.length) {
            console.error(data.errors.map((error) => error.message).join("\n"));
            return;
          }

          for (const item of data.data?.assets?.items ?? []) {
            if (item.price?.usd === undefined || item.price.usd === null) continue;
            prices.set(this.key(item.address), item.price.usd);
          }
        } catch (error) {
          console.error(error);
        }
      }),
    );

    return prices;
  }

  private query() {
    return `
      query PriceAssets($chainId: Int!, $addresses: [String!]!, $first: Int!) {
        assets(first: $first, where: { chainId_in: [$chainId], address_in: $addresses }) {
          items {
            address
            price {
              usd
            }
          }
        }
      }
    `;
  }

  private chunk<T>(items: T[], size: number) {
    const chunks: T[][] = [];

    for (let i = 0; i < items.length; i += size) {
      chunks.push(items.slice(i, i + size));
    }

    return chunks;
  }

  private key(address: Address) {
    return address.toLowerCase();
  }
}
