import type { IAccrualPosition, IMarket, IPreLiquidationPosition } from "@morpho-org/blue-sdk";
import type { Address, Chain, Hex } from "viem";

export type ToConvert = {
  src: Address;
  dst: Address;
  srcAmount: bigint;
  // minDstAmount ? (repaidAssets, can be computed within the api endpoint)
};

export type ChainConfig = {
  chain: Chain;
  rpcUrl: string;
  vaultWhitelist: Address[];
  executorAddress: Address;
  liquidationPrivateKey: Hex;
};

export type LiquidatablePosition = IAccrualPosition & { seizableCollateral: bigint };
export type PreLiquidatablePosition = IPreLiquidationPosition & { seizableCollateral: bigint };

export type IndexerAPIResponse = {
  market: IMarket;
  positionsLiq: LiquidatablePosition[];
  positionsPreLiq: PreLiquidatablePosition[];
};
