import type { Address, Hex } from "viem";
import type { LiquidatablePosition, PreLiquidatablePosition } from "./types";

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
): Promise<{
  liquidatablePositions: LiquidatablePosition[];
  preLiquidatablePositions: PreLiquidatablePosition[];
}> {
  const url = `http://localhost:42069/chain/${chainId}/liquidatable-positions`;

  const response = await fetch(url, {
    method: "POST",
    body: JSON.stringify({ marketIds }),
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch liquidatable positions: ${response.statusText}`);
  }

  const data = (await response.json()) as {
    liquidatablePositions: LiquidatablePosition[];
    preLiquidatablePositions: PreLiquidatablePosition[];
  };

  return {
    liquidatablePositions: data.liquidatablePositions.map(formatLiquidatablePosition),
    preLiquidatablePositions: data.preLiquidatablePositions.map(formatPreLiquidatablePosition),
  };
}

function formatLiquidatablePosition(position: LiquidatablePosition) {
  return {
    position: {
      ...position.position,
      supplyShares: BigInt(position.position.supplyShares),
      borrowShares: BigInt(position.position.borrowShares),
      collateral: BigInt(position.position.collateral),
    },
    marketParams: {
      ...position.marketParams,
      lltv: BigInt(position.marketParams.lltv),
    },
    seizableCollateral: BigInt(position.seizableCollateral),
    repayableAssets: BigInt(position.repayableAssets),
  };
}

function formatPreLiquidatablePosition(position: PreLiquidatablePosition) {
  return {
    ...formatLiquidatablePosition(position),
    preLiquidation: {
      ...position.preLiquidation,
      price: BigInt(position.preLiquidation.price),
      params: {
        ...position.preLiquidation.params,
        preLltv: BigInt(position.preLiquidation.params.preLltv),
        preLCF1: BigInt(position.preLiquidation.params.preLCF1),
        preLCF2: BigInt(position.preLiquidation.params.preLCF2),
        preLIF1: BigInt(position.preLiquidation.params.preLIF1),
        preLIF2: BigInt(position.preLiquidation.params.preLIF2),
      },
    },
  };
}
