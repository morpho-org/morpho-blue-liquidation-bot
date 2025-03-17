import type { Address } from "viem";

export type ToConvert = {
  src: Address;
  dst: Address;
  srcAmount: bigint;
  // minDstAmount ? (repaidAssets, can be computed within the api endpoint)
};

export type ChainConfig = {
  vaultWhitelist: Address[];
  rpcUrl: string;
};
