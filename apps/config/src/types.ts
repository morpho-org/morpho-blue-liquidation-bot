import type { Address, Chain, Hex } from "viem";

export type LiquidityVenueName =
  | "1inch"
  | "erc20Wrapper"
  | "erc4626"
  | "liquidSwap"
  | "midas"
  | "pendlePT"
  | "uniswapV3"
  | "uniswapV4";

export type PricerName = "chainlink" | "defillama" | "morphoApi" | "uniswapV3";

export type DataProviderName = "morphoApi" | "hyperIndex";

export interface Config {
  chain: Chain;
  wNative: Address;
  options: Options;
}

export interface TailMarketFilter {
  /** Lower bound (USD) for total supply assets in a candidate tail market. */
  minTvlUsd?: number;
  /** Upper bound (USD) for total supply assets. Used to exclude the big,
   * already-contested markets that pro searchers focus on. */
  maxTvlUsd?: number;
  /** Market IDs to always exclude (even if they pass other filters). */
  excludeMarkets?: Hex[];
  /** Require a `Liquidate` event on the candidate market in the last N days.
   * Proves it's an active market, not a dead listing. Default: no filter. */
  requireLiquidationLastDays?: number;
  /** How often to refresh the tail list (seconds). Default: 1 hour. */
  refreshSec?: number;
}

export interface SafetyGuards {
  /** If true, simulate liquidations end-to-end but NEVER broadcast a real
   * transaction. Use to calibrate the tail filter without burning gas. */
  dryRun?: boolean;
  /** Maximum total gas (in USD) the bot is allowed to spend on this chain
   * in a calendar day (UTC). Once hit, all sends are skipped until midnight.
   * Independent of profit — even profitable txs are skipped past the cap. */
  dailyGasCapUsd?: number;
}

export interface Options {
  dataProvider: DataProviderName;
  vaultWhitelist: Address[] | "morpho-api";
  additionalMarketsWhitelist: Hex[];
  liquidityVenues: LiquidityVenueName[];
  pricers?: PricerName[];
  treasuryAddress?: Address;
  liquidationBufferBps?: number;
  useFlashbots: boolean;
  blockInterval?: number;
  watchBlocksRetryDelayMs?: number;
  /** Tail-market discovery — when present, the bot queries the Morpho API
   * for ALL markets on this chain matching the filter, and merges the
   * result into `additionalMarketsWhitelist`. Refreshed periodically. */
  tailMarketFilter?: TailMarketFilter;
  /** Operational safety guards. All fields optional and disabled by default. */
  safety?: SafetyGuards;
}

export type ChainConfig = Omit<Config, "options"> &
  Options & {
    chainId: number;
    rpcUrl: string;
    executorAddress: Address;
    liquidationPrivateKey: Hex;
  };
