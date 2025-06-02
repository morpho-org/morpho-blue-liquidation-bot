import { IAccrualPosition, IMarket, IPreLiquidationPosition, Market } from "@morpho-org/blue-sdk";
import type { Address, Hex } from "viem";

import type { LiquidatablePosition } from "./types";

type ILiquidatablePosition = IAccrualPosition & {
  type: "IAccrualPosition";
  seizableCollateral: bigint;
};

type IPreLiquidatablePosition = IPreLiquidationPosition & {
  type: "IPreLiquidationPosition";
  seizableCollateral: bigint;
};

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

export async function fetchLiquidatablePositions(
  chainId: number,
  marketIds: Hex[],
): Promise<LiquidatablePosition[]> {
  const url = `${process.env.PONDER_SERVICE_URL ?? "http://localhost:42069"}/chain/${chainId.toFixed(0)}/liquidatable-positions`;

  const response = await fetch(url, { method: "POST", body: JSON.stringify({ marketIds }) });

  if (!response.ok) {
    throw new Error(`Failed to fetch liquidatable positions: ${response.statusText}`);
  }

  const data = (await response.json()) as {
    warnings: string[];
    results: {
      market: IMarket;
      positionsLiq: ILiquidatablePosition[];
      positionsPreLiq: IPreLiquidatablePosition[];
    }[];
  };

  if (data.warnings.length > 0) {
    console.warn(data.warnings);
  }

  return data.results.flatMap(({ market, positionsLiq }) =>
    positionsLiq.map(
      (position) =>
        ({
          position: { chainId, marketId: new Market(market).id, ...position },
          marketParams: market.params,
          seizableCollateral: position.seizableCollateral,
        }) as LiquidatablePosition,
    ),
  );
}
