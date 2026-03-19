import {
  AccrualPosition,
  Market,
  MarketId,
  PreLiquidationPosition,
  getChainAddresses,
} from "@morpho-org/blue-sdk";
import "@morpho-org/blue-sdk-viem/lib/augment";
import { fetchMarket, metaMorphoAbi } from "@morpho-org/blue-sdk-viem";
import { Time } from "@morpho-org/morpho-ts";
import type { Account, Address, Chain, Client, Hex, Transport } from "viem";
import { getAddress } from "viem";
import { multicall, readContract } from "viem/actions";

import type { DataProvider, LiquidatablePositionsResult } from "../dataProvider";

import { apiSdk } from "./api/index";

const DEFAULT_AUTHORIZATION_CACHE_COOLDOWN_PERIOD = 60 * 60 * 6; // 6 hours

const oracleAbi = [
  {
    type: "function",
    name: "price",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
] as const;

const isAuthorizedAbi = [
  {
    inputs: [
      { internalType: "address", name: "", type: "address" },
      { internalType: "address", name: "", type: "address" },
    ],
    name: "isAuthorized",
    outputs: [{ internalType: "bool", name: "", type: "bool" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

interface AuthorizationCacheEntry {
  isAuthorized: boolean;
  fetchedAt: number;
}

export class MorphoApiDataProvider implements DataProvider {
  private authorizationCache = new Map<string, AuthorizationCacheEntry>();
  private authorizationCacheCooldownPeriod: number;

  constructor(authorizationCacheCooldownPeriod?: number) {
    this.authorizationCacheCooldownPeriod =
      authorizationCacheCooldownPeriod ?? DEFAULT_AUTHORIZATION_CACHE_COOLDOWN_PERIOD;
  }

  async fetchMarkets(client: Client<Transport, Chain, Account>, vaults: Address[]): Promise<Hex[]> {
    try {
      const vaultMarkets = await Promise.all(
        vaults.map(async (vault) => this.fetchVaultMarkets(client, vault)),
      );

      return [...new Set(vaultMarkets.flat())];
    } catch (error) {
      console.error(`[Chain ${client.chain.id}] Error fetching markets for vaults:`, error);
      return [];
    }
  }

  async fetchLiquidatablePositions(
    client: Client<Transport, Chain, Account>,
    marketIds: Hex[],
  ): Promise<LiquidatablePositionsResult> {
    try {
      const PAGE_SIZE = 100;
      const MARKET_BATCH_SIZE = 100;
      const allPositions: NonNullable<
        Awaited<ReturnType<typeof apiSdk.getPositions>>["marketPositions"]["items"]
      > = [];

      // Batch market IDs into chunks of 100 (API limit)
      for (let i = 0; i < marketIds.length; i += MARKET_BATCH_SIZE) {
        const marketIdsBatch = marketIds.slice(i, i + MARKET_BATCH_SIZE);

        let skip = 0;
        while (true) {
          const positionsQuery = await apiSdk.getPositions({
            chainId: client.chain.id,
            marketIds: marketIdsBatch,
            skip,
            first: PAGE_SIZE,
          });

          const items = positionsQuery.marketPositions.items;
          if (!items || items.length === 0) break;

          allPositions.push(...items);

          if (items.length < PAGE_SIZE) break;
          skip += PAGE_SIZE;
        }
      }

      const positions = allPositions.filter(
        (position) =>
          position.market.uniqueKey !== undefined &&
          position.market.oracle !== null &&
          position.state !== null,
      );

      if (positions.length === 0)
        return { liquidatablePositions: [], preLiquidatablePositions: [] };

      // 1. Extract preLiquidation contracts from API response (first item per market)
      const preLiqContractsByMarketKey = new Map<
        string,
        {
          address: Address;
          preLltv: bigint;
          preLCF1: bigint;
          preLCF2: bigint;
          preLIF1: bigint;
          preLIF2: bigint;
          preLiquidationOracle: Address;
        }
      >();

      for (const position of positions) {
        const marketKey = position.market.uniqueKey;
        if (preLiqContractsByMarketKey.has(marketKey)) continue;

        const preLiqItems = position.market.preLiquidations?.items;
        if (preLiqItems && preLiqItems.length > 0) {
          const plc = preLiqItems[0]!;
          preLiqContractsByMarketKey.set(marketKey, {
            address: getAddress(plc.address),
            preLltv: BigInt(plc.preLltv),
            preLCF1: BigInt(plc.preLCF1),
            preLCF2: BigInt(plc.preLCF2),
            preLIF1: BigInt(plc.preLIF1),
            preLIF2: BigInt(plc.preLIF2),
            preLiquidationOracle: getAddress(plc.preLiquidationOracle),
          });
        }
      }

      // 2. Fetch markets on-chain via fetchMarket (includes oracle price for market)
      const marketResults = await Promise.allSettled(
        [...marketIds].map(async (marketId) => {
          const market = await fetchMarket(marketId as MarketId, client, {
            chainId: client.chain.id,
            deployless: false,
          });

          const now = BigInt(Time.timestamp());
          const timestamp = now > market.lastUpdate ? now : market.lastUpdate;
          return [marketId, market.accrueInterest(timestamp)] as const;
        }),
      );

      const marketsMap = new Map(
        marketResults
          .filter(
            (r): r is PromiseFulfilledResult<readonly [Hex, Market]> => r.status === "fulfilled",
          )
          .map((r) => r.value),
      );

      for (const r of marketResults) {
        if (r.status === "rejected") {
          console.error(`[Chain ${client.chain.id}] Error fetching market:`, r.reason);
        }
      }

      // 3. Collect all unique preLiquidation oracle addresses and fetch prices on-chain
      const preLiqOracleAddresses = new Set<Address>();
      for (const plc of preLiqContractsByMarketKey.values()) {
        preLiqOracleAddresses.add(plc.preLiquidationOracle);
      }

      const oraclePrices = new Map<Address, bigint | undefined>();
      await Promise.all(
        [...preLiqOracleAddresses].map(async (oracle) => {
          try {
            const price = await readContract(client, {
              address: oracle,
              abi: oracleAbi,
              functionName: "price",
            });
            oraclePrices.set(oracle, price);
          } catch (error) {
            console.error(
              `[Chain ${client.chain.id}] Error fetching oracle price for ${oracle}:`,
              error,
            );
            oraclePrices.set(oracle, undefined);
          }
        }),
      );

      // 4. Fetch authorizations on-chain with caching, batched per market
      const morphoAddress = getChainAddresses(client.chain.id).morpho;
      const now = Math.floor(Date.now() / 1000);

      // Group positions by market, then batch authorization checks per market
      const positionsByMarket = new Map<string, typeof positions>();
      for (const position of positions) {
        const marketKey = position.market.uniqueKey;
        if (!preLiqContractsByMarketKey.has(marketKey)) continue;

        let marketPositions = positionsByMarket.get(marketKey);
        if (!marketPositions) {
          marketPositions = [];
          positionsByMarket.set(marketKey, marketPositions);
        }
        marketPositions.push(position);
      }

      // For each market, collect uncached users and fetch authorizations via one multicall
      await Promise.all(
        [...positionsByMarket.entries()].map(async ([marketKey, marketPositions]) => {
          const plc = preLiqContractsByMarketKey.get(marketKey)!;

          // Deduplicate users that need fetching (not cached or cache expired)
          const usersToCheck = new Map<Address, true>();
          for (const position of marketPositions) {
            const userAddress = getAddress(position.user.address);
            const cacheKey = `${userAddress}-${plc.address}`;
            const cached = this.authorizationCache.get(cacheKey);

            if (cached && now - cached.fetchedAt < this.authorizationCacheCooldownPeriod) {
              continue;
            }
            usersToCheck.set(userAddress, true);
          }

          const users = [...usersToCheck.keys()];
          if (users.length === 0) return;

          try {
            const results = await multicall(client, {
              contracts: users.map((user) => ({
                address: morphoAddress,
                abi: isAuthorizedAbi,
                functionName: "isAuthorized" as const,
                args: [user, plc.address] as const,
              })),
            });

            for (let i = 0; i < users.length; i++) {
              const user = users[i]!;
              const cacheKey = `${user}-${plc.address}`;
              const result = results[i]!;

              this.authorizationCache.set(cacheKey, {
                isAuthorized: result.status === "success" ? result.result : false,
                fetchedAt: now,
              });

              if (result.status === "failure") {
                console.error(
                  `[Chain ${client.chain.id}] Error checking authorization for ${user} -> ${plc.address}:`,
                  result.error,
                );
              }
            }
          } catch (error) {
            console.error(
              `[Chain ${client.chain.id}] Error fetching authorizations for market ${marketKey}:`,
              error,
            );
            // On total failure, cache all as unauthorized
            for (const user of users) {
              this.authorizationCache.set(`${user}-${plc.address}`, {
                isAuthorized: false,
                fetchedAt: now,
              });
            }
          }
        }),
      );

      // 5. Build liquidatable positions
      const accruedPositions = positions
        .map((position) => {
          const market = marketsMap.get(position.market.uniqueKey);
          if (!market) return;

          const accrualPosition = new AccrualPosition(
            {
              user: position.user.address,
              supplyShares: BigInt(position.state?.supplyShares ?? "0"),
              borrowShares: BigInt(position.state?.borrowShares ?? "0"),
              collateral: BigInt(position.state?.collateral ?? "0"),
            },
            market,
          );

          return accrualPosition;
        })
        .filter((position) => position !== undefined);

      const liquidatablePositions = accruedPositions.filter(
        (position) => position.seizableCollateral !== undefined && position.seizableCollateral > 0n,
      );

      // 6. Build pre-liquidatable positions
      const preLiqCandidates: PreLiquidationPosition[] = [];

      for (const position of positions) {
        const plc = preLiqContractsByMarketKey.get(position.market.uniqueKey);
        if (!plc) continue;

        const market = marketsMap.get(position.market.uniqueKey);
        if (!market) continue;

        const userAddress = getAddress(position.user.address);
        const cacheKey = `${userAddress}-${plc.address}`;
        const cached = this.authorizationCache.get(cacheKey);

        // Skip if not authorized
        if (cached && !cached.isAuthorized) continue;

        const preLiqOraclePrice = oraclePrices.get(plc.preLiquidationOracle);

        try {
          const preLiqPosition = new PreLiquidationPosition(
            {
              user: userAddress,
              supplyShares: BigInt(position.state?.supplyShares ?? "0"),
              borrowShares: BigInt(position.state?.borrowShares ?? "0"),
              collateral: BigInt(position.state?.collateral ?? "0"),
              preLiquidation: plc.address,
              preLiquidationParams: {
                preLltv: plc.preLltv,
                preLCF1: plc.preLCF1,
                preLCF2: plc.preLCF2,
                preLIF1: plc.preLIF1,
                preLIF2: plc.preLIF2,
                preLiquidationOracle: plc.preLiquidationOracle,
              },
              preLiquidationOraclePrice: preLiqOraclePrice,
            },
            market,
          );

          if (
            preLiqPosition.seizableCollateral !== undefined &&
            preLiqPosition.seizableCollateral > 0n
          ) {
            preLiqCandidates.push(preLiqPosition);
          }
        } catch (error) {
          console.error(
            `[Chain ${client.chain.id}] Error building PreLiquidationPosition for user ${userAddress}:`,
            error,
          );
        }
      }

      // 7. Deduplication: sort by seizable collateral descending, keep best per user per market
      preLiqCandidates.sort((a, b) =>
        (a.seizableCollateral ?? 0n) > (b.seizableCollateral ?? 0n) ? -1 : 1,
      );

      const seenUsers = new Set<string>();
      const preLiquidatablePositions: PreLiquidationPosition[] = [];

      for (const pos of preLiqCandidates) {
        const key = `${pos.market.id}-${pos.user}`;
        if (!seenUsers.has(key)) {
          preLiquidatablePositions.push(pos);
          seenUsers.add(key);
        }
      }

      return { liquidatablePositions, preLiquidatablePositions };
    } catch (error) {
      console.error(`[Chain ${client.chain.id}] Error fetching liquidatable positions:`, error);
      return { liquidatablePositions: [], preLiquidatablePositions: [] };
    }
  }

  private async fetchVaultMarkets(
    client: Client<Transport, Chain, Account>,
    vaultAddress: Address,
  ): Promise<Hex[]> {
    try {
      const withdrawQueueLength = await readContract(client, {
        address: vaultAddress,
        abi: metaMorphoAbi,
        functionName: "withdrawQueueLength",
      });

      const indices = Array.from({ length: Number(withdrawQueueLength) }, (_, i) => BigInt(i));

      return await Promise.all(
        indices.map(async (index) => {
          const marketId = await readContract(client, {
            address: vaultAddress,
            abi: metaMorphoAbi,
            functionName: "withdrawQueue",
            args: [index],
          });
          return marketId;
        }),
      );
    } catch (error) {
      console.error(
        `[Chain ${client.chain.id}] Error fetching vault markets for ${vaultAddress}:`,
        error,
      );
      return [];
    }
  }
}
