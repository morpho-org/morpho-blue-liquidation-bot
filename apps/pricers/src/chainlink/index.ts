import {
  DENOMINATIONS,
  FEED_REGISTRY_ADDRESS,
  MAPPINGS,
} from "@morpho-blue-liquidation-bot/config";
import {
  formatUnits,
  type Account,
  type Address,
  type Chain,
  type Client,
  type Transport,
} from "viem";
import { readContract } from "viem/actions";
import { mainnet } from "viem/chains";

import { feedRegistryAbi } from "../abis/feedRegistry";
import type { Pricer } from "../pricer";

type CoinKey = `${string}:${Address}`;

interface CachedPrice {
  price: number;
  fetchTimestamp: number;
}

export class ChainlinkPricer implements Pricer {
  private readonly CACHE_TIMEOUT_MS = 30_000; // 30 seconds

  private priceCache = new Map<CoinKey, CachedPrice>();

  async price(
    client: Client<Transport, Chain, Account>,
    asset: Address,
  ): Promise<number | undefined> {
    asset = MAPPINGS[asset] ?? asset;

    // Feed Registry is only available on Ethereum Mainnet
    if (client.chain.id !== mainnet.id) {
      return undefined;
    }

    const coinKey: CoinKey = `${client.chain.name}:${asset}`;
    const cachedPrice = this.priceCache.get(coinKey);

    // Return cached price if available and not expired
    if (cachedPrice && Date.now() - cachedPrice.fetchTimestamp < this.CACHE_TIMEOUT_MS) {
      return cachedPrice.price;
    }

    try {
      // Query price from Feed Registry
      const [roundData, decimals] = await Promise.all([
        readContract(client, {
          address: FEED_REGISTRY_ADDRESS,
          abi: feedRegistryAbi,
          functionName: "latestRoundData",
          args: [asset, DENOMINATIONS.USD],
        }),
        readContract(client, {
          address: FEED_REGISTRY_ADDRESS,
          abi: feedRegistryAbi,
          functionName: "decimals",
          args: [asset, DENOMINATIONS.USD],
        }),
      ]);

      // Extract price from round data (answer is the price)
      const rawPrice = roundData[1];

      // Ensure price is positive
      if (rawPrice <= 0n) {
        return undefined;
      }

      // Convert to proper decimal representation
      const price = Number(formatUnits(rawPrice, decimals));

      // Cache the result
      this.priceCache.set(coinKey, { price, fetchTimestamp: Date.now() });

      return price;
    } catch (error) {
      if (error instanceof Error) {
        console.error(`Error fetching Chainlink price for ${asset}:`, error);
      } else {
        console.error(`Error fetching Chainlink price for ${asset}:`, String(error));
      }
      return undefined;
    }
  }
}
