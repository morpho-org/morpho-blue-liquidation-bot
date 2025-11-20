import * as Sentry from "@sentry/node";
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

import { feedRegistryAbi } from "../../abis/feed-registry-abi";
import type { Pricer } from "../pricer";

type CoinKey = `${string}:${Address}`;

/**
 * ISO 4217 denominations used by Chainlink
 */
const DENOMINATIONS = {
  EUR: "0x00000000000000000000000000000000000003d2",
  GBP: "0x000000000000000000000000000000000000033a",
  USD: "0x0000000000000000000000000000000000000348",
  ETH: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
  BTC: "0xbBbBBBBbbBBBbbbBbbBbbbbBBbBbbbbBbBbbBBbB",
} as const;

const MAPPINGS: Record<Address, Address> = {
  ["0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"]: DENOMINATIONS.ETH, // WETH → ETH
  ["0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599"]: DENOMINATIONS.BTC, // WBTC → BTC
};

interface CachedPrice {
  price: number;
  fetchTimestamp: number;
}

export class ChainlinkPricer implements Pricer {
  private readonly FEED_REGISTRY_ADDRESS: Address = "0x47Fb2585D2C56Fe188D0E6ec628a38b74fCeeeDf";
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
          address: this.FEED_REGISTRY_ADDRESS,
          abi: feedRegistryAbi,
          functionName: "latestRoundData",
          args: [asset, DENOMINATIONS.USD],
        }),
        readContract(client, {
          address: this.FEED_REGISTRY_ADDRESS,
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
        Sentry.captureException(error, {
          tags: {
            chainId: client.chain.id.toString(),
            operation: "price: Chainlink",
            asset,
          },
        });
      } else {
        console.error(`Error fetching Chainlink price for ${asset}:`, String(error));
      }
      return undefined;
    }
  }
}
