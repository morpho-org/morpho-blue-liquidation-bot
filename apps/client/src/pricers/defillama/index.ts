import type { Account, Address, Chain, Client, Transport } from "viem";

import type { Pricer } from "../pricer";

type CoinKey = `${string}:0x${string}`;

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

  supportsChain(): boolean {
    return true;
  }

  async supportsAsset(client: Client<Transport, Chain, Account>, asset: Address): Promise<boolean> {
    try {
      const price = await this.fetchPrice(client, asset);
      return price !== undefined;
    } catch {
      return false;
    }
  }

  async price(client: Client<Transport, Chain, Account>, asset: Address): Promise<number> {
    const cacheKey = this.getCoinKey(client, asset);
    const cachedResult = this.priceCache.get(cacheKey);

    if (cachedResult && Date.now() - cachedResult.fetchTimestamp < this.cacheTimeoutMs) {
      return cachedResult.price;
    }

    const price = await this.fetchPrice(client, asset);
    if (price === undefined) {
      throw new Error(`No price found for asset ${asset} on ${client.chain.name}`);
    }

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
    return `${client.chain.name}:${asset}`;
  }
}
