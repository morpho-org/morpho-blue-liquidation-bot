import { parseUnits } from "viem";

export const WAD = parseUnits("1", 18);
export const ORACLE_PRICE_SCALE = parseUnits("1", 36);

export const VIRTUAL_ASSETS = 1n;
export const VIRTUAL_SHARES = 10n ** 6n;

export const mulDivDown = (x: bigint, y: bigint, d: bigint): bigint => (x * y) / d;
export const mulDivUp = (x: bigint, y: bigint, d: bigint): bigint => (x * y + (d - 1n)) / d;
export const wMulDown = (x: bigint, y: bigint): bigint => mulDivDown(x, y, WAD);

export const toAssetsUp = (shares: bigint, totalAssets: bigint, totalShares: bigint): bigint => {
  return mulDivUp(shares, totalAssets + VIRTUAL_ASSETS, totalShares + VIRTUAL_SHARES);
};
