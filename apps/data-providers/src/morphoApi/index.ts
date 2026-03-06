import { AccrualPosition, MarketId } from "@morpho-org/blue-sdk";
import "@morpho-org/blue-sdk-viem/lib/augment";
import { fetchMarket, metaMorphoAbi } from "@morpho-org/blue-sdk-viem";
import { Time } from "@morpho-org/morpho-ts";
import type { Account, Address, Chain, Client, Hex, Transport } from "viem";
import { readContract } from "viem/actions";

import { apiSdk } from "../api/index";
import type { DataProvider } from "../dataProvider";

export class MorphoApiDataProvider implements DataProvider {
  async fetchMarkets(client: Client<Transport, Chain, Account>, vaults: Address[]): Promise<Hex[]> {
    try {
      const vaultMarkets = await Promise.all(
        vaults.map(async (vault) => this.fetchVaultMarkets(client, vault)),
      );

      return [...new Set(vaultMarkets.flat())];
    } catch (error) {
      console.error(`Error fetching markets for vaults: ${error}`);
      return [];
    }
  }

  async fetchLiquidatablePositions(
    client: Client<Transport, Chain, Account>,
    marketIds: Hex[],
  ): Promise<AccrualPosition[]> {
    try {
      const positionsQuery = await apiSdk.getLiquidatablePositions({
        chainId: client.chain.id,
        marketIds,
        skip: 0,
        first: 100,
      });

      const positions = positionsQuery.marketPositions.items?.filter(
        (position) =>
          position.market.uniqueKey !== undefined &&
          position.market.oracle !== null &&
          position.state !== null,
      );

      if (!positions) return [];

      const marketsMap = new Map(
        await Promise.all(
          [...marketIds].map(async (marketId) => {
            const market = await fetchMarket(marketId as MarketId, client, {
              chainId: client.chain.id,
              // Disable `deployless` so that viem multicall aggregates fetches
              deployless: false,
            });

            return [marketId, market.accrueInterest(Time.timestamp())] as const;
          }),
        ),
      );

      const accruedPositions = (positions ?? [])
        .map((position) => {
          const market = marketsMap.get(position.market.uniqueKey);
          if (!market) return;

          const accrualPosition = new AccrualPosition(
            {
              user: position.user.address,
              // NOTE: These come as strings when mocking GraphQL response in tests, so we cast manually
              supplyShares: BigInt(position.state?.supplyShares ?? "0"),
              borrowShares: BigInt(position.state?.borrowShares ?? "0"),
              collateral: BigInt(position.state?.collateral ?? "0"),
            },
            market,
          );

          return accrualPosition;
        })
        .filter((position) => position !== undefined);

      return accruedPositions.filter((position) => position.seizableCollateral !== undefined);
    } catch (error) {
      console.error(`Error fetching liquidatable positions: ${error}`);
      return [];
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
      console.error(`Error fetching vault markets: ${error}`);
      return [];
    }
  }
}
