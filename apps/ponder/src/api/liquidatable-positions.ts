import {
  AccrualPosition,
  type IAccrualPosition,
  type IMarket,
  type IPreLiquidationPosition,
  Market,
  MarketParams,
  PreLiquidationPosition,
} from "@morpho-org/blue-sdk";
import { and, eq, inArray, gt, type ReadonlyDrizzle } from "ponder";
import { type Address, zeroAddress, type Hex, type PublicClient } from "viem";

import { oracleAbi } from "../../abis/Oracle";
// NOTE: Use relative path rather than "ponder:schema" so that tests can import from this file
import * as schema from "../../ponder.schema";

type ILiquidatablePosition = (
  | (IAccrualPosition & { type: "IAccrualPosition" })
  | (IPreLiquidationPosition & { type: "IPreLiquidationPosition" })
) & {
  seizableCollateral: bigint;
};

export async function getLiquidatablePositions({
  db,
  chainId,
  publicClient,
  marketIds,
}: {
  db: ReadonlyDrizzle<typeof schema>;
  chainId: number;
  publicClient: PublicClient;
  marketIds: Hex[];
}) {
  const [marketRows, preLiquidationRows] = await Promise.all([
    // Grab markets for all `marketIds`, along with associated borrow positions
    db.query.market.findMany({
      where: (row) => and(eq(row.chainId, chainId), inArray(row.id, marketIds)),
      with: { positions: { where: (row) => gt(row.borrowShares, 0n) } },
    }),
    // Grab (position, preLiquidationContract) tuples, relating them by authorization
    db
      .select({
        position: schema.position,
        preLiquidationContract: schema.preLiquidationContract,
      })
      .from(schema.preLiquidationContract)
      .leftJoin(
        schema.authorization,
        and(
          eq(schema.authorization.chainId, schema.preLiquidationContract.chainId),
          eq(schema.authorization.authorizee, schema.preLiquidationContract.address),
          eq(schema.authorization.isAuthorized, true),
        ),
      )
      .innerJoin(
        schema.position,
        and(
          eq(schema.position.chainId, schema.preLiquidationContract.chainId),
          eq(schema.position.marketId, schema.preLiquidationContract.marketId),
          eq(schema.position.user, schema.authorization.authorizer),
          gt(schema.position.borrowShares, 0n),
        ),
      )
      .where(
        and(
          eq(schema.preLiquidationContract.chainId, chainId),
          inArray(schema.preLiquidationContract.marketId, marketIds),
        ),
      ),
  ]);

  // Coalesce rows so we have one entry per market
  const preLiquidationCandidates = new Map<Address, typeof preLiquidationRows>();
  for (const row of preLiquidationRows) {
    if (!preLiquidationCandidates.has(row.position.marketId)) {
      preLiquidationCandidates.set(row.position.marketId, []);
    }
    preLiquidationCandidates.get(row.position.marketId)?.push(row);
  }

  const oracleSet = new Set([
    ...marketRows.map((market) => market.oracle),
    ...preLiquidationRows.map((c) => c.preLiquidationContract.preLiquidationOracle),
  ]);
  oracleSet.delete(zeroAddress);
  const oracles = [...oracleSet];

  // Fetch prices from each unique oracle
  const pricesArr = await publicClient.multicall({
    contracts: oracles.map((oracle) => ({
      abi: oracleAbi,
      address: oracle,
      functionName: "price",
    })),
    allowFailure: true,
    batchSize: 2 ** 16,
  });
  const prices: Record<Address, (typeof pricesArr)[number]> = {};
  for (let i = 0; i < oracles.length; i += 1) {
    // biome-ignore lint/style/noNonNullAssertion: never null
    prices[oracles[i]!] = pricesArr[i]!;
  }

  const now = (Date.now() / 1000).toFixed(0);

  const warnings: string[] = [];
  const results: {
    market: IMarket;
    positionsLiq: ILiquidatablePosition[];
    positionsPreLiq: ILiquidatablePosition[];
  }[] = [];

  const getPrice = (oracle: Address) => {
    const price = prices[oracle];
    if (oracle === zeroAddress) {
      return;
    }
    if (price === undefined) {
      warnings.push(`${oracle} was skipped when fetching prices -- SHOULD NEVER HAPPEN.`);
      return;
    }
    if (price.status === "failure") {
      warnings.push(`${oracle} failed to return a price ${price.error}`);
      return;
    }
    return price.result;
  };

  for (const { positions: dbPositions, ...dbMarket } of marketRows) {
    const price = getPrice(dbMarket.oracle);
    if (price === undefined) continue;

    const market = new Market({
      ...dbMarket,
      params: new MarketParams(dbMarket),
      price,
    }).accrueInterest(now);
    // Restructure data for use with @morpho-org/blue-sdk (`AccrualPosition`s)
    const positionsLiq: ILiquidatablePosition[] = dbPositions
      .map((dbPosition) => {
        const iposition = dbPosition;
        return {
          // NOTE: We spread `iposition` rather than the `AccrualPosition` to minimize bandwidth
          // (the latter has additional, extra fields).
          ...iposition,
          type: "IAccrualPosition" as const,
          seizableCollateral: new AccrualPosition(dbPosition, market).seizableCollateral ?? 0n,
        };
      })
      .filter((position) => position.seizableCollateral > 0n);
    // Restructure data for use with @morpho-org/blue-sdk (`PreLiquidationPosition`s)
    const positionsPreLiq: ILiquidatablePosition[] = (preLiquidationCandidates.get(market.id) ?? [])
      .map((c) => {
        // If this is `undefined`, the position will be filtered out later when
        // checking `seizableCollateral > 0n`. This is what we want.
        const preLiquidationOraclePrice = getPrice(c.preLiquidationContract.preLiquidationOracle);
        const iposition = {
          ...c.position,
          preLiquidation: c.preLiquidationContract.address,
          preLiquidationParams: (({ chainId, address, marketId, ...rest }) => rest)(
            c.preLiquidationContract,
          ),
          preLiquidationOraclePrice,
        };
        return {
          // NOTE: We spread `iposition` rather than the `PreLiquidationPosition` to minimize bandwidth
          // (the latter has additional, extra fields).
          ...iposition,
          type: "IPreLiquidationPosition" as const,
          seizableCollateral:
            new PreLiquidationPosition(iposition, market).seizableCollateral ?? 0n,
        };
      })
      .filter((position) => position.seizableCollateral > 0n);

    // Sort
    positionsLiq.sort((a, b) => (a.seizableCollateral > b.seizableCollateral ? -1 : 1));
    positionsPreLiq.sort((a, b) => (a.seizableCollateral > b.seizableCollateral ? -1 : 1));

    // Only keep the first occurrence of each user. They may have approved multiple PreLiquidation
    // contracts, but we only care about the one with the largest `seizableCollateral`.
    const positionsPreLiqBest: typeof positionsPreLiq = [];
    const userSet = new Set<Address>();

    for (const position of positionsPreLiq) {
      if (!userSet.has(position.user)) {
        positionsPreLiqBest.push(position);
        userSet.add(position.user);
      }
    }

    if (positionsLiq.length > 0 || positionsPreLiqBest.length > 0) {
      results.push({ market, positionsLiq, positionsPreLiq: positionsPreLiqBest });
    }
  }

  return { warnings, results };
}
