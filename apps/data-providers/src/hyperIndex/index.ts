import { AccrualPosition, Market } from "@morpho-org/blue-sdk";
import { GraphQLClient } from "graphql-request";
import gql from "graphql-tag";
import type { Account, Address, Chain, Client, Hex, Transport } from "viem";

import type { DataProvider } from "../dataProvider";

const DEFAULT_HYPERINDEX_URL = "http://localhost:8080/v1/graphql";

const GET_LIQUIDATABLE_POSITIONS = gql`
  query GetLiquidatablePositions($marketIds: [String!]!, $chainId: Int!) {
    Position(where: { market_id: { _in: $marketIds }, borrowShares: { _gt: "0" } }) {
      user
      market_id
      supplyShares
      borrowShares
      collateral
    }
    Market(where: { id: { _in: $marketIds } }) {
      id
      marketId
      loanToken
      collateralToken
      oracle
      irm
      lltv
      totalSupplyAssets
      totalSupplyShares
      totalBorrowAssets
      totalBorrowShares
      lastUpdate
      fee
      rateAtTarget
    }
  }
`;

const GET_VAULT_MARKETS = gql`
  query GetVaultMarkets($vaultIds: [String!]!) {
    Vault(where: { id: { _in: $vaultIds } }) {
      id
      withdrawQueue
    }
  }
`;

interface HyperIndexPosition {
  user: string;
  market_id: string;
  supplyShares: string;
  borrowShares: string;
  collateral: string;
}

interface HyperIndexMarket {
  id: string;
  marketId: string;
  loanToken: string;
  collateralToken: string;
  oracle: string;
  irm: string;
  lltv: string;
  totalSupplyAssets: string;
  totalSupplyShares: string;
  totalBorrowAssets: string;
  totalBorrowShares: string;
  lastUpdate: string;
  fee: string;
  rateAtTarget: string;
}

interface HyperIndexVault {
  id: string;
  withdrawQueue: string[];
}

interface LiquidatablePositionsResponse {
  Position: HyperIndexPosition[];
  Market: HyperIndexMarket[];
}

interface VaultMarketsResponse {
  Vault: HyperIndexVault[];
}

export class HyperIndexDataProvider implements DataProvider {
  private readonly client: GraphQLClient;

  constructor(url: string = DEFAULT_HYPERINDEX_URL) {
    this.client = new GraphQLClient(url);
  }

  async fetchMarkets(client: Client<Transport, Chain, Account>, vaults: Address[]): Promise<Hex[]> {
    try {
      const vaultIds = vaults.map((v) => `${client.chain.id}-${v.toLowerCase()}`);

      const response = await this.client.request<VaultMarketsResponse>(GET_VAULT_MARKETS, {
        vaultIds,
      });

      const marketIds = response.Vault.flatMap((vault) => vault.withdrawQueue);
      return [...new Set(marketIds)] as Hex[];
    } catch (error) {
      console.error(`Error fetching markets from HyperIndex: ${error}`);
      return [];
    }
  }

  async fetchLiquidatablePositions(
    client: Client<Transport, Chain, Account>,
    marketIds: Hex[],
  ): Promise<AccrualPosition[]> {
    try {
      const indexedMarketIds = marketIds.map((id) => `${client.chain.id}-${id}`);

      const response = await this.client.request<LiquidatablePositionsResponse>(
        GET_LIQUIDATABLE_POSITIONS,
        { marketIds: indexedMarketIds, chainId: client.chain.id },
      );

      const marketsMap = new Map<string, Market>();
      for (const m of response.Market) {
        const market = new Market({
          params: {
            loanToken: m.loanToken as Address,
            collateralToken: m.collateralToken as Address,
            oracle: m.oracle as Address,
            irm: m.irm as Address,
            lltv: BigInt(m.lltv),
          },
          totalSupplyAssets: BigInt(m.totalSupplyAssets),
          totalSupplyShares: BigInt(m.totalSupplyShares),
          totalBorrowAssets: BigInt(m.totalBorrowAssets),
          totalBorrowShares: BigInt(m.totalBorrowShares),
          lastUpdate: BigInt(m.lastUpdate),
          fee: BigInt(m.fee),
          rateAtTarget: BigInt(m.rateAtTarget),
          price: undefined,
        });

        marketsMap.set(m.id, market);
      }

      const accruedPositions = response.Position.map((p) => {
        const market = marketsMap.get(p.market_id);
        if (!market) return;

        const accrualPosition = new AccrualPosition(
          {
            user: p.user as Address,
            supplyShares: BigInt(p.supplyShares),
            borrowShares: BigInt(p.borrowShares),
            collateral: BigInt(p.collateral),
          },
          market.accrueInterest(BigInt(Math.floor(Date.now() / 1000))),
        );

        return accrualPosition;
      }).filter((position) => position !== undefined);

      return accruedPositions.filter((position) => position.seizableCollateral !== undefined);
    } catch (error) {
      console.error(`Error fetching liquidatable positions from HyperIndex: ${error}`);
      return [];
    }
  }
}
