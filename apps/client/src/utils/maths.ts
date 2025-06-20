export const WAD = 10n ** 18n;
export const DEFAULT_LIQUIDATION_BUFFER_BPS = 10;

export function wMulDown(x: bigint, y: bigint) {
  return (x * y) / 10n ** 18n;
}
