import type { Account, Address, Chain, Client, Hex, Transport } from "viem";
import { multicall } from "viem/actions";

import { morphoBlueAbi } from "../abis/morpho/morphoBlue";

import type { IndexerState } from "./state";

export async function spotCheck(
  client: Client<Transport, Chain, Account>,
  state: IndexerState,
  morphoAddress: Address,
  blockNumber: bigint,
  sampleSize: number,
): Promise<string[]> {
  const mismatches: string[] = [];

  const marketIds = [...state.markets.keys()];
  if (marketIds.length === 0) return mismatches;

  // Sample random markets
  const sampledMarketIds = sampleRandom(marketIds, sampleSize);

  const marketCalls = sampledMarketIds.map((id) => ({
    address: morphoAddress,
    abi: morphoBlueAbi,
    functionName: "market" as const,
    args: [id] as const,
  }));

  // Sample random non-zero positions
  const nonZeroPositionKeys: string[] = [];
  for (const [key, pos] of state.positions) {
    if (pos.supplyShares !== 0n || pos.borrowShares !== 0n || pos.collateral !== 0n) {
      nonZeroPositionKeys.push(key);
    }
  }

  const sampledPositionKeys = sampleRandom(nonZeroPositionKeys, sampleSize);
  const positionCalls = sampledPositionKeys.map((key) => {
    const separatorIndex = key.indexOf("-", 3);
    const marketId = key.slice(0, separatorIndex) as Hex;
    const user = key.slice(separatorIndex + 1) as Address;
    return {
      address: morphoAddress,
      abi: morphoBlueAbi,
      functionName: "position" as const,
      args: [marketId, user] as const,
    };
  });

  const allCalls = [...marketCalls, ...positionCalls];
  if (allCalls.length === 0) return mismatches;

  const results = await multicall(client, {
    contracts: allCalls,
    allowFailure: true,
    blockNumber,
  });

  // Compare market results
  for (let i = 0; i < sampledMarketIds.length; i++) {
    const r = results[i]!;
    if (r.status !== "success") continue;

    const id = sampledMarketIds[i]!;
    const indexed = state.markets.get(id)!;
    const [totalSupplyAssets, totalSupplyShares, totalBorrowAssets, totalBorrowShares, , fee] =
      r.result as [bigint, bigint, bigint, bigint, bigint, bigint];

    if (indexed.totalSupplyAssets !== totalSupplyAssets)
      mismatches.push(
        `market ${id}: totalSupplyAssets ${indexed.totalSupplyAssets} vs ${totalSupplyAssets}`,
      );
    if (indexed.totalSupplyShares !== totalSupplyShares)
      mismatches.push(
        `market ${id}: totalSupplyShares ${indexed.totalSupplyShares} vs ${totalSupplyShares}`,
      );
    if (indexed.totalBorrowAssets !== totalBorrowAssets)
      mismatches.push(
        `market ${id}: totalBorrowAssets ${indexed.totalBorrowAssets} vs ${totalBorrowAssets}`,
      );
    if (indexed.totalBorrowShares !== totalBorrowShares)
      mismatches.push(
        `market ${id}: totalBorrowShares ${indexed.totalBorrowShares} vs ${totalBorrowShares}`,
      );
    if (indexed.fee !== fee) mismatches.push(`market ${id}: fee ${indexed.fee} vs ${fee}`);
  }

  // Compare position results
  for (let i = 0; i < sampledPositionKeys.length; i++) {
    const r = results[sampledMarketIds.length + i]!;
    if (r.status !== "success") continue;

    const key = sampledPositionKeys[i]!;
    const indexed = state.positions.get(key)!;
    const [supplyShares, borrowShares, collateral] = r.result as [bigint, bigint, bigint];

    if (indexed.supplyShares !== supplyShares)
      mismatches.push(`position ${key}: supplyShares ${indexed.supplyShares} vs ${supplyShares}`);
    if (indexed.borrowShares !== borrowShares)
      mismatches.push(`position ${key}: borrowShares ${indexed.borrowShares} vs ${borrowShares}`);
    if (indexed.collateral !== collateral)
      mismatches.push(`position ${key}: collateral ${indexed.collateral} vs ${collateral}`);
  }

  return mismatches;
}

function sampleRandom<T>(array: T[], n: number): T[] {
  if (array.length <= n) return array;
  const shuffled = [...array];
  // Fisher-Yates shuffle (partial, only first n elements)
  for (let i = 0; i < n; i++) {
    const j = i + Math.floor(Math.random() * (shuffled.length - i));
    [shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!];
  }
  return shuffled.slice(0, n);
}
