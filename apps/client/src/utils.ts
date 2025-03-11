import type { Address } from "viem";

export type ToConvert = {
  src: Address;
  dst: Address;
  srcAmount: bigint;
  // minDstAmount ? (repaidAssets, can be computed within the api endpoint)
};

export type AdditionalParams = {
  marketParams?: MarketParams;
  borrower?: Address;
};

export type MarketParams = {
  loanToken: Address;
  collateralToken: Address;
  oracle: Address;
  irm: Address;
  lltv: bigint;
};
