import type { Address, Hex } from "viem";

export interface IndexedMarketParams {
  loanToken: Address;
  collateralToken: Address;
  oracle: Address;
  irm: Address;
  lltv: bigint;
}

export interface IndexedMarketState {
  params: IndexedMarketParams;
  totalSupplyAssets: bigint;
  totalSupplyShares: bigint;
  totalBorrowAssets: bigint;
  totalBorrowShares: bigint;
  lastUpdate: bigint;
  fee: bigint;
  rateAtTarget: bigint | undefined;
}

export interface IndexedPositionState {
  supplyShares: bigint;
  borrowShares: bigint;
  collateral: bigint;
}

export interface IndexedPreLiquidationContract {
  marketId: Hex;
  address: Address;
  preLiquidationParams: {
    preLltv: bigint;
    preLCF1: bigint;
    preLCF2: bigint;
    preLIF1: bigint;
    preLIF2: bigint;
    preLiquidationOracle: Address;
  };
}

export interface IndexerState {
  markets: Map<Hex, IndexedMarketState>;
  positions: Map<string, IndexedPositionState>;
  authorizations: Map<string, boolean>;
  preLiquidationContracts: IndexedPreLiquidationContract[];
  vaultWithdrawQueues: Map<Address, Hex[]>;
}

export function positionKey(marketId: Hex, user: Address): string {
  return `${marketId}-${user.toLowerCase()}`;
}

export function authorizationKey(authorizer: Address, authorizee: Address): string {
  return `${authorizer.toLowerCase()}-${authorizee.toLowerCase()}`;
}

export function createEmptyState(): IndexerState {
  return {
    markets: new Map(),
    positions: new Map(),
    authorizations: new Map(),
    preLiquidationContracts: [],
    vaultWithdrawQueues: new Map(),
  };
}

export function cloneState(state: IndexerState): IndexerState {
  return {
    markets: new Map(
      Array.from(state.markets.entries()).map(([k, v]) => [k, { ...v, params: { ...v.params } }]),
    ),
    positions: new Map(Array.from(state.positions.entries()).map(([k, v]) => [k, { ...v }])),
    authorizations: new Map(state.authorizations),
    preLiquidationContracts: state.preLiquidationContracts.map((c) => ({
      ...c,
      preLiquidationParams: { ...c.preLiquidationParams },
    })),
    vaultWithdrawQueues: new Map(
      Array.from(state.vaultWithdrawQueues.entries()).map(([k, v]) => [k, [...v]]),
    ),
  };
}
