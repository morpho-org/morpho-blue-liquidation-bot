export function zeroFloorSub(x: bigint, y: bigint) {
  return x < y ? 0n : x - y;
}

export function wMulDown(x: bigint, y: bigint) {
  return (x * y) / 10n ** 18n;
}
