import type { AnvilTestClient } from "@morpho-org/test";
import { ExecutorEncoder } from "executooor-viem";
import type { Address } from "viem";
import { vi } from "vitest";

import { OneInch } from "../src/1inch";

export class OneInchTest extends OneInch {
  private readonly supportedNetworks: number[];

  constructor(supportedNetworks: number[]) {
    super();
    this.supportedNetworks = supportedNetworks;
  }

  supportsRoute(encoder: ExecutorEncoder, _src: Address, _dst: Address) {
    return this.supportedNetworks.includes(encoder.client.chain.id);
  }
}

export const syncTimestamp = async (client: AnvilTestClient, timestamp?: bigint) => {
  timestamp ??= (await client.timestamp()) + 60n;

  vi.useFakeTimers({
    now: Number(timestamp) * 1000,
    toFake: ["Date"],
  });

  vi.setSystemTime(Number(timestamp) * 1000);

  await client.setNextBlockTimestamp({ timestamp });

  return timestamp;
};
