import type { Address, Hex } from "viem";

import type { IndexerState, IndexedPositionState } from "./state";
import { positionKey, authorizationKey } from "./state";

// Decoded log shape from viem getLogs with ABI
interface DecodedLog {
  args: Record<string, unknown>;
  eventName?: string;
  blockNumber: bigint;
  logIndex: number;
}

export class MissingEventError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MissingEventError";
  }
}

function getOrCreatePosition(state: IndexerState, key: string): IndexedPositionState {
  let pos = state.positions.get(key);
  if (!pos) {
    pos = { supplyShares: 0n, borrowShares: 0n, collateral: 0n };
    state.positions.set(key, pos);
  }
  return pos;
}

function pruneIfEmpty(state: IndexerState, key: string, pos: IndexedPositionState): void {
  if (pos.supplyShares === 0n && pos.borrowShares === 0n && pos.collateral === 0n) {
    state.positions.delete(key);
  }
}

function requireMarket(state: IndexerState, id: Hex, eventName: string) {
  const market = state.markets.get(id);
  if (!market) {
    throw new MissingEventError(
      `${eventName} cannot precede CreateMarket (market ${id} not found). ` +
        "This indicates a missed CreateMarket event.",
    );
  }
  return market;
}

function requirePosition(state: IndexerState, id: Hex, user: Address, eventName: string) {
  const key = positionKey(id, user);
  const pos = state.positions.get(key);
  if (!pos) {
    throw new MissingEventError(
      `${eventName} for position ${key} requires a prior Supply/SupplyCollateral event. ` +
        "This indicates a missed event.",
    );
  }
  return pos;
}

// ---- Morpho Blue event handlers ----

export function handleCreateMarket(state: IndexerState, log: DecodedLog): void {
  const id = log.args.id as Hex;
  const mp = log.args.marketParams as {
    loanToken: Address;
    collateralToken: Address;
    oracle: Address;
    irm: Address;
    lltv: bigint;
  };
  state.markets.set(id, {
    params: {
      loanToken: mp.loanToken,
      collateralToken: mp.collateralToken,
      oracle: mp.oracle,
      irm: mp.irm,
      lltv: mp.lltv,
    },
    totalSupplyAssets: 0n,
    totalSupplyShares: 0n,
    totalBorrowAssets: 0n,
    totalBorrowShares: 0n,
    lastUpdate: 0n,
    fee: 0n,
    rateAtTarget: undefined,
  });
}

export function handleSetFee(state: IndexerState, log: DecodedLog): void {
  const id = log.args.id as Hex;
  const market = requireMarket(state, id, "SetFee");
  market.fee = log.args.newFee as bigint;
}

export function handleAccrueInterest(
  state: IndexerState,
  log: DecodedLog,
  blockTimestamp: bigint,
): void {
  const id = log.args.id as Hex;
  const market = requireMarket(state, id, "AccrueInterest");
  const interest = log.args.interest as bigint;
  const feeShares = log.args.feeShares as bigint;
  market.totalSupplyAssets += interest;
  market.totalBorrowAssets += interest;
  market.totalSupplyShares += feeShares;
  if (blockTimestamp !== 0n) market.lastUpdate = blockTimestamp;
}

export function handleSupply(state: IndexerState, log: DecodedLog): void {
  const id = log.args.id as Hex;
  const market = requireMarket(state, id, "Supply");
  const assets = log.args.assets as bigint;
  const shares = log.args.shares as bigint;
  market.totalSupplyAssets += assets;
  market.totalSupplyShares += shares;

  const user = log.args.onBehalf as Address;
  const pos = getOrCreatePosition(state, positionKey(id, user));
  pos.supplyShares += shares;
}

export function handleWithdraw(state: IndexerState, log: DecodedLog): void {
  const id = log.args.id as Hex;
  const market = requireMarket(state, id, "Withdraw");
  const assets = log.args.assets as bigint;
  const shares = log.args.shares as bigint;
  market.totalSupplyAssets -= assets;
  market.totalSupplyShares -= shares;

  const user = log.args.onBehalf as Address;
  const key = positionKey(id, user);
  const pos = requirePosition(state, id, user, "Withdraw");
  pos.supplyShares -= shares;
  pruneIfEmpty(state, key, pos);
}

export function handleBorrow(state: IndexerState, log: DecodedLog): void {
  const id = log.args.id as Hex;
  const market = requireMarket(state, id, "Borrow");
  const assets = log.args.assets as bigint;
  const shares = log.args.shares as bigint;
  market.totalBorrowAssets += assets;
  market.totalBorrowShares += shares;

  const user = log.args.onBehalf as Address;
  const pos = requirePosition(state, id, user, "Borrow");
  pos.borrowShares += shares;
}

export function handleRepay(state: IndexerState, log: DecodedLog): void {
  const id = log.args.id as Hex;
  const market = requireMarket(state, id, "Repay");
  const assets = log.args.assets as bigint;
  const shares = log.args.shares as bigint;
  market.totalBorrowAssets -= assets;
  market.totalBorrowShares -= shares;

  const user = log.args.onBehalf as Address;
  const key = positionKey(id, user);
  const pos = requirePosition(state, id, user, "Repay");
  pos.borrowShares -= shares;
  pruneIfEmpty(state, key, pos);
}

export function handleSupplyCollateral(state: IndexerState, log: DecodedLog): void {
  const id = log.args.id as Hex;
  const user = log.args.onBehalf as Address;
  const assets = log.args.assets as bigint;
  const pos = getOrCreatePosition(state, positionKey(id, user));
  pos.collateral += assets;
}

export function handleWithdrawCollateral(state: IndexerState, log: DecodedLog): void {
  const id = log.args.id as Hex;
  const user = log.args.onBehalf as Address;
  const assets = log.args.assets as bigint;
  const key = positionKey(id, user);
  const pos = requirePosition(state, id, user, "WithdrawCollateral");
  pos.collateral -= assets;
  pruneIfEmpty(state, key, pos);
}

export function handleLiquidate(state: IndexerState, log: DecodedLog): void {
  const id = log.args.id as Hex;
  const market = requireMarket(state, id, "Liquidate");

  const repaidAssets = log.args.repaidAssets as bigint;
  const repaidShares = log.args.repaidShares as bigint;
  const seizedAssets = log.args.seizedAssets as bigint;
  const badDebtAssets = log.args.badDebtAssets as bigint;
  const badDebtShares = log.args.badDebtShares as bigint;

  market.totalBorrowAssets -= repaidAssets;
  market.totalBorrowShares -= repaidShares;
  market.totalSupplyAssets -= badDebtAssets;
  market.totalSupplyShares -= badDebtShares;

  const borrower = log.args.borrower as Address;
  const key = positionKey(id, borrower);
  const pos = requirePosition(state, id, borrower, "Liquidate");
  pos.collateral -= seizedAssets;
  pos.borrowShares -= repaidShares + badDebtShares;
  pruneIfEmpty(state, key, pos);
}

export function handleSetAuthorization(state: IndexerState, log: DecodedLog): void {
  const authorizer = log.args.authorizer as Address;
  const authorized = log.args.authorized as Address;
  const isAuth = log.args.newIsAuthorized as boolean;
  const key = authorizationKey(authorizer, authorized);
  if (isAuth) {
    state.authorizations.set(key, true);
  } else {
    state.authorizations.delete(key);
  }
}

// ---- AdaptiveCurveIRM event handler ----

export function handleBorrowRateUpdate(state: IndexerState, log: DecodedLog): void {
  const id = log.args.id as Hex;
  const rateAtTarget = log.args.rateAtTarget as bigint;
  const market = state.markets.get(id);
  if (market) market.rateAtTarget = rateAtTarget;
}

// ---- PreLiquidation Factory event handler ----

export function handleCreatePreLiquidation(state: IndexerState, log: DecodedLog): void {
  const preLiquidationParams = log.args.preLiquidationParams as {
    preLltv: bigint;
    preLCF1: bigint;
    preLCF2: bigint;
    preLIF1: bigint;
    preLIF2: bigint;
    preLiquidationOracle: Address;
  };

  state.preLiquidationContracts.push({
    marketId: log.args.id as Hex,
    address: log.args.preLiquidation as Address,
    preLiquidationParams,
  });
}

// ---- MetaMorpho event handler ----

export function handleSetWithdrawQueue(
  state: IndexerState,
  log: DecodedLog,
  vaultAddress: Address,
): void {
  const newQueue = log.args.newWithdrawQueue as Hex[];
  state.vaultWithdrawQueues.set(vaultAddress.toLowerCase() as Address, newQueue);
}

// ---- Dispatch ----

type MorphoHandler = (state: IndexerState, log: DecodedLog, blockTimestamp: bigint) => void;

const MORPHO_HANDLERS: Record<string, MorphoHandler> = {
  CreateMarket: (state, log) => {
    handleCreateMarket(state, log);
  },
  SetFee: (state, log) => {
    handleSetFee(state, log);
  },
  AccrueInterest: handleAccrueInterest,
  Supply: (state, log) => {
    handleSupply(state, log);
  },
  Withdraw: (state, log) => {
    handleWithdraw(state, log);
  },
  Borrow: (state, log) => {
    handleBorrow(state, log);
  },
  Repay: (state, log) => {
    handleRepay(state, log);
  },
  SupplyCollateral: (state, log) => {
    handleSupplyCollateral(state, log);
  },
  WithdrawCollateral: (state, log) => {
    handleWithdrawCollateral(state, log);
  },
  Liquidate: (state, log) => {
    handleLiquidate(state, log);
  },
  SetAuthorization: (state, log) => {
    handleSetAuthorization(state, log);
  },
};

export function getMorphoHandler(eventName: string): MorphoHandler | undefined {
  return MORPHO_HANDLERS[eventName];
}
