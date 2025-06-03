import type { Address, Hex } from "viem";

export interface MarketState {
  totalSupplyAssets: bigint;
  totalSupplyShares: bigint;
  totalBorrowAssets: bigint;
  totalBorrowShares: bigint;
  lastUpdate: bigint;
  fee: bigint;
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
