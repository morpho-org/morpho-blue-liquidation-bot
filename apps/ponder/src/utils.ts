export function zeroFloorSub(x: bigint, y: bigint) {
  return x < y ? 0n : x - y;
}
