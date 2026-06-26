export type TokenConfig = {
  dataFeed: `0x${string}`;
  fee: bigint;
  allowance: bigint;
  stable: boolean;
};

export type PreviewRedeemInstantParams = {
  amountMTokenIn: bigint;
  tokenOutConfig: TokenConfig;
  tokenOutDecimals: bigint;
  dailyLimits: bigint;
  mTokenRate: bigint;
  tokenOutRate: bigint;
  minAmount: bigint;
  instantFee: bigint;
  instantDailyLimit: bigint;
  STABLECOIN_RATE: bigint;
  waivedFeeRestriction: boolean;
};
