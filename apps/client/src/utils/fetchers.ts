import type { Address } from "viem";

export async function fetchWhiteListedMarkets(
  chainId: number,
  vaultAddress: Address,
): Promise<string[]> {
  const url = `http://localhost:42069/chain/${chainId}/vault/${vaultAddress}`;

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch ${vaultAddress} whitelisted markets: ${response.statusText}`);
  }

  const markets = (await response.json()) as string[];

  return markets;
}
