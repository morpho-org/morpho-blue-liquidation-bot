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
  const url = `http://localhost:42069/chain/${chainId}/withdraw-queue/${vaultAddress}`;

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch ${vaultAddress} whitelisted markets: ${response.statusText}`);
  }

  const markets = (await response.json()) as Hex[];

  return markets;
}

export async function fetchLiquidatablePositions(chainId: number, marketIds: Hex[]) {
  const url = `http://localhost:42069/chain/${chainId}/liquidatable-positions`;

  const response = await fetch(url, {
    method: "POST",
    body: JSON.stringify({ marketIds }),
  });

  const data = (await response.json()) as { results: IndexerAPIResponse[]; warnings: string[] };

  if (!response.ok) {
    throw new Error(`Failed to fetch liquidatable positions: ${response.statusText}`);
  }

  if (data.warnings.length > 0) {
    console.warn(data.warnings);
  }

  return parseWithBigInt<IndexerAPIResponse[]>(JSON.stringify(data.results));
}
