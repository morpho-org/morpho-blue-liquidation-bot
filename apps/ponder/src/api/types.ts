import type { Address, Hex } from "viem";

export interface MarketState {
  totalSupplyAssets: bigint;
  totalSupplyShares: bigint;
  totalBorrowAssets: bigint;
  totalBorrowShares: bigint;
  lastUpdate: bigint;
  fee: bigint;
}

export interface PreLiquidationParams {
  preLltv: bigint;
  preLCF1: bigint;
  preLCF2: bigint;
  preLIF1: bigint;
  preLIF2: bigint;
  preLiquidationOracle: Address;
}

export type LiquidatablePosition = {
  position: {
    chainId: number;
    marketId: Hex;
    user: Address;
    collateral: string;
    borrowShares: string;
    supplyShares: string;
  };
  marketParams: {
    loanToken: Address;
    collateralToken: Address;
    irm: Address;
    oracle: Address;
    lltv: string;
  };
  seizableCollateral: string;
  repayableAssets: string;
};

export type PreLiquidatablePosition = LiquidatablePosition & {
  preLiquidation: {
    address: Address;
    params: {
      preLltv: string;
      preLCF1: string;
      preLCF2: string;
      preLIF1: string;
      preLIF2: string;
      preLiquidationOracle: Address;
    };
    price: string;
  };
};
