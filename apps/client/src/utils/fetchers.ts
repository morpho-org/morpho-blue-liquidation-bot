import type { Address, Hex } from "viem";
import type { IndexerAPIResponse } from "./types";

export function parseWithBigInt<T = unknown>(jsonText: string): T {
  return JSON.parse(jsonText, (_key, value) => {
    if (typeof value === "string" && /^-?\d+n$/.test(value)) {
      return BigInt(value.slice(0, -1));
    }
    return value;
  }) as T;
}

export async function fetchWhiteListedMarketsForVault(
  chainId: number,
  vaultAddress: Address,
): Promise<Hex[]> {
  const url = `${process.env.PONDER_SERVICE_URL ?? "http://localhost:42069"}/chain/${chainId.toFixed(0)}/vault/${vaultAddress}`;

  const response = await fetch(url, { method: "POST", body: JSON.stringify({}) });

  if (!response.ok) {
    throw new Error(`Failed to fetch ${vaultAddress} whitelisted markets: ${response.statusText}`);
  }

  try {
    const data = (await response.json()) as { withdrawQueue: { marketId: Hex }[] } | undefined;
    return data?.withdrawQueue.map((q) => q.marketId) ?? [];
  } catch {
    return [];
  }
}

export async function fetchLiquidatablePositions(chainId: number, marketIds: Hex[]) {
  const url = `${process.env.PONDER_SERVICE_URL ?? "http://localhost:42069"}/chain/${chainId.toFixed(0)}/liquidatable-positions`;

  const response = await fetch(url, {
    method: "POST",
    body: JSON.stringify({ marketIds }),
  });

  const data = (await response.json()) as { results: IndexerAPIResponse[] };

  console.log(data);

  if (!response.ok) {
    throw new Error(`Failed to fetch liquidatable positions: ${response.statusText}`);
  }

  return parseWithBigInt<IndexerAPIResponse[]>(JSON.stringify(data.results));
}
