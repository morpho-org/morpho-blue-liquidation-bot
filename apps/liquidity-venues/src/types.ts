import type { Address } from "viem";

export interface ToConvert {
  src: Address;
  dst: Address;
  srcAmount: bigint;
}
