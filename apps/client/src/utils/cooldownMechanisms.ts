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

export class MarketsFetchingCooldownMechanism {
  private cooldownPeriod: number;
  private readyAt: number;

  constructor(cooldownPeriod: number) {
    this.cooldownPeriod = cooldownPeriod;
    this.readyAt = 0;
  }

  isFetchingReady() {
    if (this.readyAt > Date.now() / 1000) {
      return false;
    }
    this.readyAt = Date.now() / 1000 + this.cooldownPeriod;
    return true;
  }
}
