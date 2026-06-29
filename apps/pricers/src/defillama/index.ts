import type { Account, Address, Chain, Client, Transport } from "viem";

import type { Pricer } from "../pricer";

type CoinKey = `${string}:0x${string}`;

// DeFiLlama's pricing API uses its own chain slugs, which do not always match
// viem's `chain.name`. Keep this map in sync with what DeFiLlama accepts for
// each chain listed in apps/config/src/config.ts.
export const DEFILLAMA_CHAIN_SLUGS: Record<number, string> = {
  1: "ethereum",
  130: "unichain",
  137: "polygon",
  143: "monad",
  480: "wc",
  747474: "katana",
  999: "hyperliquid",
  8453: "base",
  42161: "arbitrum",
};

interface CachedPrice {
  price: number;
  fetchTimestamp: number;
  apiTimestamp: number;
}

interface DefiLlamaPriceResponse {
  coins: Record<
    CoinKey,
    {
      decimals: number;
      price: number;
      symbol: string;
      timestamp: number;
    }
  >;
}

export class DefiLlamaPricer implements Pricer {
  private priceCache = new Map<CoinKey, CachedPrice>();
  private readonly cacheTimeoutMs: number = 10_000; // 10 seconds

  async price(client: Client<Transport, Chain, Account>, asset: Address) {
    const cacheKey = this.getCoinKey(client, asset);
    const cachedResult = this.priceCache.get(cacheKey);

    if (cachedResult && Date.now() - cachedResult.fetchTimestamp < this.cacheTimeoutMs) {
      return cachedResult.price;
    }

    const price = await this.fetchPrice(client, asset);

    return price;
  }

  private async fetchPrice(
    client: Client<Transport, Chain, Account>,
    asset: Address,
  ): Promise<number | undefined> {
    const coinKey = this.getCoinKey(client, asset);
    const url = `https://coins.llama.fi/prices/current/${coinKey}`;

    try {
      const response = await fetch(url);
      if (!response.ok) {
        return undefined;
      }

      const data = (await response.json()) as DefiLlamaPriceResponse;
      const coinData = data.coins[coinKey];

      if (!coinData) {
        return undefined;
      }

      this.priceCache.set(coinKey, {
        price: coinData.price,
        fetchTimestamp: Date.now(),
        apiTimestamp: coinData.timestamp,
      });

      return coinData.price;
    } catch {
      return undefined;
    }
  }

  private getCoinKey(client: Client<Transport, Chain, Account>, asset: Address): CoinKey {
    const slug = DEFILLAMA_CHAIN_SLUGS[client.chain.id] ?? client.chain.name.toLowerCase();
    return `${slug}:${asset}`;
  }
}
