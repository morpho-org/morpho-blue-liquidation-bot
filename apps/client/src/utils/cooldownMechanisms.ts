import { Address, Hex } from "viem";

export class PositionLiquidationCooldownMechanism {
  private cooldownPeriod: number;
  private positionReadyAt: Record<Hex, Record<Address, number>>;

  constructor(cooldownPeriod: number) {
    this.cooldownPeriod = cooldownPeriod;
    this.positionReadyAt = {};
  }

  isPositionReady(marketId: Hex, account: Address) {
    if (this.positionReadyAt[marketId] === undefined) {
      this.positionReadyAt[marketId] = {};
    }

    if (this.positionReadyAt[marketId][account] === undefined) {
      this.positionReadyAt[marketId][account] = 0;
    }

    if (this.positionReadyAt[marketId][account] > Date.now() / 1000) {
      return false;
    }

    this.positionReadyAt[marketId][account] = Date.now() / 1000 + this.cooldownPeriod;
    return true;
  }
}

/** Default seconds before retrying a failed `fetchMarkets` (RPC / Morpho API blip). */
const DEFAULT_MARKETS_FETCH_RETRY_SEC = 60;

export class MarketsFetchingCooldownMechanism {
  private readonly cooldownPeriodSeconds: number;
  private readonly retryDelaySeconds: number;
  private readyAt: number;

  constructor(cooldownPeriodSeconds: number, retryDelaySeconds = DEFAULT_MARKETS_FETCH_RETRY_SEC) {
    this.cooldownPeriodSeconds = cooldownPeriodSeconds;
    this.retryDelaySeconds = retryDelaySeconds;
    this.readyAt = 0;
  }

  isReady(): boolean {
    return Date.now() / 1000 >= this.readyAt;
  }

  scheduleNextFetchAfterSuccess(): void {
    this.readyAt = Date.now() / 1000 + this.cooldownPeriodSeconds;
  }

  scheduleRetryAfterFailure(): void {
    this.readyAt = Date.now() / 1000 + this.retryDelaySeconds;
  }
}
