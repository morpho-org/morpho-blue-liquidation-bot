import type { Address, Hex } from "viem";

import type { IndexerAPIResponse } from "./types";

const PONDER_SERVICE_URL = process.env.PONDER_SERVICE_URL ?? "http://localhost:42069";

// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
export function parseWithBigInt<T = unknown>(jsonText: string): T {
  return JSON.parse(jsonText, (_key, value) => {
    if (typeof value === "string" && /^-?\d+n$/.test(value)) {
      return BigInt(value.slice(0, -1));
    }
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return value;
  }) as T;
}

export async function fetchMarketsForVaults(chainId: number, vaults: Address[]): Promise<Hex[]> {
  const url = new URL(`/chain/${chainId}/withdraw-queue-set`, PONDER_SERVICE_URL);

  const response = await fetch(url, { method: "POST", body: JSON.stringify({ vaults }) });

  if (!response.ok) {
    console.error(
      new Error(`Failed to fetch ${vaults} whitelisted markets: ${response.statusText}`),
    );
    return [];
  }

  const markets = (await response.json()) as Hex[];

  return markets;
}

export async function fetchLiquidatablePositions(chainId: number, marketIds: Hex[]) {
  const url = new URL(`/chain/${chainId}/liquidatable-positions`, PONDER_SERVICE_URL);

  const response = await fetch(url, {
    method: "POST",
    body: JSON.stringify({ marketIds }),
  });

  if (!response.ok) {
    console.error(`Failed to fetch liquidatable positions: ${response.statusText}`);
  }

  const data = parseWithBigInt<{ results: IndexerAPIResponse[]; warnings: string[] }>(
    await response.text(),
  );

  if (data.warnings.length > 0) {
    console.warn(data.warnings);
  }

  return data.results;
}
