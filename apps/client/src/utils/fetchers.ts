import type { Address, Hex } from "viem";
import type { LiquidatablePosition } from "./types";

export async function fetchWhiteListedMarketsForVault(
  chainId: number,
  vaultAddress: Address,
): Promise<Hex[]> {
  const url = `http://localhost:42069/chain/${chainId}/vault/${vaultAddress}`;

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch ${vaultAddress} whitelisted markets: ${response.statusText}`);
  }

  const markets = (await response.json()) as Hex[];

  return markets;
}

export async function fetchLiquidatablePositions(
  chainId: number,
  marketIds: Hex[],
): Promise<LiquidatablePosition[]> {
  const url = `http://localhost:42069/chain/${chainId}/liquidatable-positions`;

  const response = await fetch(url, {
    method: "POST",
    body: JSON.stringify({ marketIds }),
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch liquidatable positions: ${response.statusText}`);
  }

  const liquidatablePositions = (await response.json()) as LiquidatablePosition[];

  return liquidatablePositions;
}
