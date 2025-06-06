import type { IAccrualPosition, IMarket, IPreLiquidationPosition } from "@morpho-org/blue-sdk";
import type { Address, Chain, Hex } from "viem";

export interface ToConvert {
  src: Address;
  dst: Address;
  srcAmount: bigint;
}

export interface ChainConfig {
  chain: Chain;
  rpcUrl: string;
  vaultWhitelist: Address[];
  executorAddress: Address;
  liquidationPrivateKey: Hex;
}

export type LiquidatablePosition = IAccrualPosition & { seizableCollateral: bigint };
export type PreLiquidatablePosition = IPreLiquidationPosition & { seizableCollateral: bigint };

export interface IndexerAPIResponse {
  market: IMarket;
  positionsLiq: LiquidatablePosition[];
  positionsPreLiq: PreLiquidatablePosition[];
}
