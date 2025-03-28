import { parseUnits } from "viem";

import type { MarketState } from "./types";

const YEAR = 60n * 60n * 24n * 365n;
const WAD = parseUnits("1", 18);
const ORACLE_PRICE_SCALE = parseUnits("1", 36);
const LIQUIDATION_CURSOR = parseUnits("0.3", 18);
const MAX_LIQUIDATION_INCENTIVE_FACTOR = parseUnits("1.15", 18);

const VIRTUAL_ASSETS = 1n;
const VIRTUAL_SHARES = 10n ** 6n;

/// IRM CONSTANTS
const CURVE_STEEPNESS = parseUnits("4", 18);
const ADJUSTMENT_SPEED = parseUnits("50", 18) / YEAR;
const TARGET_UTILIZATION = parseUnits("0.9", 18);
const INITIAL_RATE_AT_TARGET = parseUnits("0.04", 18) / YEAR;
const MIN_RATE_AT_TARGET = parseUnits("0.001", 18) / YEAR;
const MAX_RATE_AT_TARGET = parseUnits("2", 18) / YEAR;

/// EXPONENTIAL CONSTANTS
const LN_2_INT = parseUnits("0.693147180559945309", 18);
const LN_WEI_INT = -parseUnits("41.446531673892822312", 18);
const WEXP_UPPER_BOUND = parseUnits("93.859467695000404319", 18);
const WEXP_UPPER_VALUE = parseUnits(
  "57716089161558943949701069502944508345128.422502756744429568",
  18,
);

const min = (a: bigint, b: bigint) => (a < b ? a : b);

const mulDivDown = (x: bigint, y: bigint, d: bigint): bigint => (x * y) / d;
const mulDivUp = (x: bigint, y: bigint, d: bigint): bigint => (x * y + (d - 1n)) / d;
const wDivDown = (x: bigint, y: bigint): bigint => mulDivDown(x, WAD, y);
const wDivUp = (x: bigint, y: bigint): bigint => mulDivUp(x, WAD, y);
const wMulDown = (x: bigint, y: bigint): bigint => mulDivDown(x, y, WAD);

const toAssetsUp = (shares: bigint, totalAssets: bigint, totalShares: bigint): bigint => {
  return mulDivUp(shares, totalAssets + VIRTUAL_ASSETS, totalShares + VIRTUAL_SHARES);
};
const toAssetsDown = (shares: bigint, totalAssets: bigint, totalShares: bigint): bigint => {
  return mulDivDown(shares, totalAssets + VIRTUAL_ASSETS, totalShares + VIRTUAL_SHARES);
};
const toSharesUp = (assets: bigint, totalAssets: bigint, totalShares: bigint): bigint => {
  return mulDivUp(assets, totalShares + VIRTUAL_SHARES, totalAssets + VIRTUAL_ASSETS);
};

export const toSharesDown = (assets: bigint, totalAssets: bigint, totalShares: bigint): bigint => {
  return mulDivDown(assets, totalShares + VIRTUAL_SHARES, totalAssets + VIRTUAL_ASSETS);
};

export function accrueInterest(
  marketState: MarketState,
  rateAtTarget: bigint,
  timestamp: bigint,
): MarketState {
  const elapsed = timestamp - marketState.lastUpdate;
  if (elapsed === 0n) return marketState;

  if (marketState.totalBorrowAssets !== 0n) {
    const interest = wMulDown(
      marketState.totalBorrowAssets,
      wTaylorCompounded(borrowRate(marketState, rateAtTarget, timestamp), elapsed),
    );
    const marketWithNewTotal = {
      ...marketState,
      totalBorrowAssets: marketState.totalBorrowAssets + interest,
      totalSupplyAssets: marketState.totalSupplyAssets + interest,
    };

    if (marketWithNewTotal.fee !== 0n) {
      const feeAmount = wMulDown(interest, marketWithNewTotal.fee);

      const feeShares = toSharesDown(
        feeAmount,
        marketWithNewTotal.totalSupplyAssets - feeAmount,
        marketWithNewTotal.totalSupplyShares,
      );
      return {
        ...marketWithNewTotal,
        totalSupplyShares: marketWithNewTotal.totalSupplyShares + feeShares,
      };
    }
    return marketWithNewTotal;
  }
  return marketState;
}

const liquidationIncentiveFactor = (lltv: bigint): bigint => {
  return min(
    MAX_LIQUIDATION_INCENTIVE_FACTOR,
    wDivDown(WAD, WAD - wMulDown(LIQUIDATION_CURSOR, WAD - lltv)),
  );
};

export function liquidationValues(
  collateral: bigint,
  borrowShares: bigint,
  totalBorrowShares: bigint,
  totalBorrowAssets: bigint,
  lltv: bigint,
  collateralPrice: bigint,
) {
  const borrowed = toAssetsUp(borrowShares, totalBorrowAssets, totalBorrowShares);
  const maxBorrow = wMulDown(mulDivDown(collateral, collateralPrice, ORACLE_PRICE_SCALE), lltv);

  if (borrowed > maxBorrow) {
    const seizableCollateral = min(
      collateral,
      mulDivDown(
        wMulDown(
          toAssetsDown(borrowShares, totalBorrowAssets, totalBorrowShares),
          liquidationIncentiveFactor(lltv),
        ),
        ORACLE_PRICE_SCALE,
        collateralPrice,
      ),
    );

    const seizedAssetsQuoted = mulDivUp(seizableCollateral, collateralPrice, ORACLE_PRICE_SCALE);
    const repaidShares = toSharesUp(
      wDivUp(seizedAssetsQuoted, liquidationIncentiveFactor(lltv)),
      totalBorrowAssets,
      totalBorrowShares,
    );
    const repayableAssets = toAssetsUp(repaidShares, totalBorrowAssets, totalBorrowShares);

    return { seizableCollateral, repayableAssets };
  }
  return { seizableCollateral: 0n, repayableAssets: 0n };
}

const wTaylorCompounded = (x: bigint, n: bigint): bigint => {
  const firstTerm = x * n;
  const secondTerm = mulDivDown(firstTerm, firstTerm, 2n * WAD);
  const thirdTerm = mulDivDown(secondTerm, firstTerm, 3n * WAD);
  return firstTerm + secondTerm + thirdTerm;
};

export function borrowRate(
  market: MarketState,
  startRateAtTarget: bigint,
  timestamp: bigint,
): bigint {
  const utilization =
    market.totalSupplyAssets > 0n
      ? wDivDown(market.totalBorrowAssets, market.totalSupplyAssets)
      : 0n;

  const errNormFactor =
    utilization > TARGET_UTILIZATION ? WAD - TARGET_UTILIZATION : TARGET_UTILIZATION;

  const err = wDivToZero(utilization - TARGET_UTILIZATION, errNormFactor);

  let avgRateAtTarget = 0n;
  let endRateAtTarget = 0n;

  if (startRateAtTarget === 0n) {
    avgRateAtTarget = INITIAL_RATE_AT_TARGET;
    endRateAtTarget = INITIAL_RATE_AT_TARGET;
  } else {
    const speed = wMulToZero(ADJUSTMENT_SPEED, err);
    const elapsed = timestamp - market.lastUpdate;
    const linearAdaptation = speed * elapsed;

    if (linearAdaptation === 0n) {
      avgRateAtTarget = startRateAtTarget;
      endRateAtTarget = startRateAtTarget;
    } else {
      endRateAtTarget = newRateAtTarget(startRateAtTarget, linearAdaptation);
      const midRateAtTarget = newRateAtTarget(startRateAtTarget, linearAdaptation / 2n);
      avgRateAtTarget = (startRateAtTarget + endRateAtTarget + 2n * midRateAtTarget) / 4n;
    }
  }

  return curve(avgRateAtTarget, err);
}

const wMulToZero = (x: bigint, y: bigint): bigint => {
  return (x * y) / WAD;
};

const wDivToZero = (x: bigint, y: bigint): bigint => {
  return (x * WAD) / y;
};

const newRateAtTarget = (startRateAtTarget: bigint, linearAdaptation: bigint): bigint => {
  return bound(
    wMulToZero(startRateAtTarget, wExp(linearAdaptation)),
    MIN_RATE_AT_TARGET,
    MAX_RATE_AT_TARGET,
  );
};

const curve = (rateAtTarget: bigint, err: bigint): bigint => {
  const coeff = err < 0n ? WAD - wDivToZero(WAD, CURVE_STEEPNESS) : CURVE_STEEPNESS - WAD;
  return wMulToZero(wMulToZero(coeff, err) + WAD, rateAtTarget);
};

const wExp = (x: bigint): bigint => {
  if (x < LN_WEI_INT) return 0n;
  if (x >= WEXP_UPPER_BOUND) return WEXP_UPPER_VALUE;
  const roundingAdjustment = x < 0n ? -(LN_2_INT / 2n) : LN_2_INT / 2n;
  const q = (x + roundingAdjustment) / LN_2_INT;
  const r = x - q * LN_2_INT;
  const expR = WAD + r + (r * r) / WAD / 2n;
  if (q >= 0) return expR << q;
  return expR >> -q;
};

const bound = (x: bigint, min: bigint, max: bigint): bigint => {
  if (x < min) return min;
  if (x > max) return max;
  return x;
};
