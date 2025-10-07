import { Address, Hex } from "viem";

export class CooldownMechanism {
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
