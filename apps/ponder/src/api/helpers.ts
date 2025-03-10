import { parseUnits } from "viem";

const WAD = parseUnits("1", 18);
const ORACLE_PRICE_SCALE = parseUnits("1", 36);
const LIQUIDATION_CURSOR = parseUnits("0.3", 18);
const MAX_LIQUIDATION_INCENTIVE_FACTOR = parseUnits("1.15", 18);

const VIRTUAL_ASSETS = 1n;
const VIRTUAL_SHARES = 10n ** 6n;

const min = (a: bigint, b: bigint) => (a < b ? a : b);

const mulDivDown = (x: bigint, y: bigint, d: bigint): bigint => (x * y) / d;
const mulDivUp = (x: bigint, y: bigint, d: bigint): bigint => (x * y + (d - 1n)) / d;
const wDivDown = (x: bigint, y: bigint): bigint => mulDivDown(x, WAD, y);
const wMulDown = (x: bigint, y: bigint): bigint => mulDivDown(x, y, WAD);

const toAssetsUp = (shares: bigint, totalAssets: bigint, totalShares: bigint): bigint => {
  return mulDivUp(shares, totalAssets + VIRTUAL_ASSETS, totalShares + VIRTUAL_SHARES);
};
const toAssetsDown = (shares: bigint, totalAssets: bigint, totalShares: bigint): bigint => {
  return mulDivDown(shares, totalAssets + VIRTUAL_ASSETS, totalShares + VIRTUAL_SHARES);
};

const liquidationIncentiveFactor = (lltv: bigint): bigint => {
  return min(
    MAX_LIQUIDATION_INCENTIVE_FACTOR,
    wDivDown(WAD, WAD - wMulDown(LIQUIDATION_CURSOR, WAD - lltv)),
  );
};

export const seizableCollateral = (
  collateral: bigint,
  borrowShares: bigint,
  totalBorrowShares: bigint,
  totalBorrowAssets: bigint,
  lltv: bigint,
  collateralPrice: bigint,
) => {
  const borrowed = toAssetsUp(borrowShares, totalBorrowAssets, totalBorrowShares);
  const maxBorrow = wMulDown(mulDivDown(collateral, collateralPrice, ORACLE_PRICE_SCALE), lltv);

  if (borrowed > maxBorrow) {
    return min(
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
  }
  return undefined;
};
