import type { Account, Address, Chain, Client, Hex, Transport } from "viem";
import {
  AccrualPosition,
  Market,
  MarketParams,
} from "@morpho-org/blue-sdk";
import { Time } from "@morpho-org/morpho-ts";

import { multicall } from "viem/actions";
import { oracleAbi } from "../abis/morpho/oracle.js";
import { zeroAddress } from "viem";

const ENVIO_GRAPHQL_URL =
  process.env.ENVIO_GRAPHQL_URL ?? "http://localhost:8080/v1/graphql";

async function envioQuery<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
  const res = await fetch(ENVIO_GRAPHQL_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }),
  });

  const json = (await res.json()) as { data?: T; errors?: { message: string }[] };

  if (json.errors?.length) {
    throw new Error(`Envio GraphQL error: ${json.errors.map((e) => e.message).join(", ")}`);
  }

  if (!json.data) {
    throw new Error("Envio GraphQL returned no data");
  }

  return json.data;
}

interface EnvioVault {
  address: string;
  withdrawQueue: string[];
}

interface EnvioMarket {
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

interface EnvioPosition {
  user: string;
  market_id: string;
  supplyShares: string;
  borrowShares: string;
  collateral: string;
}

interface EnvioPreLiquidationContract {
  market_id: string;
  address: string;
  preLltv: string;
  preLCF1: string;
  preLCF2: string;
  preLIF1: string;
  preLIF2: string;
  preLiquidationOracle: string;
}

interface EnvioAuthorization {
  authorizer: string;
  authorizee: string;
  isAuthorized: boolean;
}

export async function fetchMarketsForVaults(
  client: Client<Transport, Chain, Account>,
  vaults: Address[],
): Promise<Hex[]> {
  try {
    const data = await envioQuery<{ Vault: EnvioVault[] }>(
      `query ($chainId: Int!, $addresses: [String!]!) {
        Vault(where: { chainId: { _eq: $chainId }, address: { _in: $addresses } }) {
          address
          withdrawQueue
        }
      }`,
      {
        chainId: client.chain.id,
        addresses: vaults.map((v) => v.toLowerCase()),
      },
    );

    const allMarketIds = data.Vault.flatMap((vault) => vault.withdrawQueue);
    return [...new Set(allMarketIds)] as Hex[];
  } catch (error) {
    console.error(`Error fetching markets for vaults from Envio: ${error}`);
    return [];
  }
}

export async function fetchLiquidatablePositions(
  client: Client<Transport, Chain, Account>,
  marketIds: Hex[],
) {
  try {
    const chainId = client.chain.id;
    const compositeMarketIds = marketIds.map((id) => `${chainId}-${id}`);

    // Fetch positions with borrows and market data from Envio
    const data = await envioQuery<{
      Position: EnvioPosition[];
      Market: EnvioMarket[];
      PreLiquidationContract: EnvioPreLiquidationContract[];
      Authorization: EnvioAuthorization[];
    }>(
      `query ($chainId: Int!, $marketIds: [String!]!) {
        Position(where: {
          chainId: { _eq: $chainId },
          market_id: { _in: $marketIds },
          borrowShares: { _gt: "0" }
        }) {
          user
          market_id
          supplyShares
          borrowShares
          collateral
        }
        Market(where: {
          chainId: { _eq: $chainId },
          id: { _in: $marketIds }
        }) {
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
        PreLiquidationContract(where: {
          chainId: { _eq: $chainId },
          market_id: { _in: $marketIds }
        }) {
          market_id
          address
          preLltv
          preLCF1
          preLCF2
          preLIF1
          preLIF2
          preLiquidationOracle
        }
        Authorization(where: {
          chainId: { _eq: $chainId },
          isAuthorized: { _eq: true }
        }) {
          authorizer
          authorizee
          isAuthorized
        }
      }`,
      {
        chainId,
        marketIds: compositeMarketIds,
      },
    );

    // Collect all unique oracle addresses
    const oracleSet = new Set<Address>();
    for (const market of data.Market) {
      if (market.oracle !== zeroAddress) oracleSet.add(market.oracle as Address);
    }
    for (const plc of data.PreLiquidationContract) {
      if (plc.preLiquidationOracle !== zeroAddress)
        oracleSet.add(plc.preLiquidationOracle as Address);
    }
    const oracles = [...oracleSet];

    // Fetch oracle prices via RPC multicall
    const pricesArr = await multicall(client, {
      contracts: oracles.map((oracle) => ({
        abi: oracleAbi,
        address: oracle,
        functionName: "price" as const,
      })),
      allowFailure: true,
      batchSize: 2 ** 16,
    });

    const prices = new Map<Address, bigint>();
    for (let i = 0; i < oracles.length; i++) {
      const result = pricesArr[i]!;
      if (result.status === "success") {
        prices.set(oracles[i]!, result.result as bigint);
      }
    }

    const now = Time.timestamp();

    // Build authorization lookup (authorizee -> set of authorizers)
    const authorizations = new Map<string, Set<string>>();
    for (const auth of data.Authorization) {
      const key = auth.authorizee.toLowerCase();
      if (!authorizations.has(key)) authorizations.set(key, new Set());
      authorizations.get(key)!.add(auth.authorizer.toLowerCase());
    }

    // Build markets and compute accrued positions
    const results: AccrualPosition[] = [];

    for (const dbMarket of data.Market) {
      const price = prices.get(dbMarket.oracle as Address);
      if (price === undefined && dbMarket.oracle !== zeroAddress) continue;

      const market = new Market({
        params: new MarketParams({
          loanToken: dbMarket.loanToken as Address,
          collateralToken: dbMarket.collateralToken as Address,
          oracle: dbMarket.oracle as Address,
          irm: dbMarket.irm as Address,
          lltv: BigInt(dbMarket.lltv),
        }),
        totalSupplyAssets: BigInt(dbMarket.totalSupplyAssets),
        totalSupplyShares: BigInt(dbMarket.totalSupplyShares),
        totalBorrowAssets: BigInt(dbMarket.totalBorrowAssets),
        totalBorrowShares: BigInt(dbMarket.totalBorrowShares),
        lastUpdate: BigInt(dbMarket.lastUpdate),
        fee: BigInt(dbMarket.fee),
        rateAtTarget: BigInt(dbMarket.rateAtTarget),
        price: price ?? 0n,
      }).accrueInterest(now);

      const positions = data.Position.filter((p) => p.market_id === dbMarket.id);

      for (const dbPosition of positions) {
        const accrualPosition = new AccrualPosition(
          {
            user: dbPosition.user as Address,
            supplyShares: BigInt(dbPosition.supplyShares),
            borrowShares: BigInt(dbPosition.borrowShares),
            collateral: BigInt(dbPosition.collateral),
          },
          market,
        );

        if (accrualPosition.seizableCollateral !== undefined && accrualPosition.seizableCollateral > 0n) {
          results.push(accrualPosition);
        }
      }
    }

    return results;
  } catch (error) {
    console.error(`Error fetching liquidatable positions from Envio: ${error}`);
    return [];
  }
}
