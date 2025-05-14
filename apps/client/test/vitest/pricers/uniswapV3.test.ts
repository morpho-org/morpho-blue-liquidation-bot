import { describe, expect } from "vitest";
import { getAddress } from "viem";
import { test } from "../../setup.js";
import { UniswapV3Pricer } from "../../../src/pricers";
import { WBTC, USDC, USDC_BASE, WETH } from "../../constants.js";
import { randomAddress } from "@morpho-org/test";
import { USD_REFERENCE } from "@morpho-blue-liquidation-bot/config";
import { randomInt } from "node:crypto";

describe("morpho api pricer", () => {
  const pricer = new UniswapV3Pricer();

  test.sequential("should test supportsChain", async () => {
    const supportedIds = Object.keys(USD_REFERENCE).map(Number);

    for (const id of supportedIds) {
      expect(pricer.supportsChain(id)).toBe(true);
    }

    for (let i = 0; i < 10; i++) {
      const randomId = randomInt(0, 1000000);
      if (supportedIds.includes(randomId)) continue;
      expect(pricer.supportsChain(randomId)).toBe(false);
    }
  });

  test.sequential("should test supportsAsset", async ({ client }) => {
    expect(await pricer.supportsAsset(client, WBTC)).toBe(true);
    expect(await pricer.supportsAsset(client, WETH)).toBe(true);
    expect(await pricer.supportsAsset(client, USDC)).toBe(true);
    expect(await pricer.supportsAsset(client, USDC_BASE)).toBe(false);
    expect(await pricer.supportsAsset(client, getAddress(randomAddress(1)))).toBe(false);
  });

  test.sequential("should test price", async ({ client }) => {
    /// Prices at the time of the fork
    expect(Math.abs((await pricer.price(client, WBTC)!) - 68000)).toBeLessThan(1000);
    expect(Math.abs((await pricer.price(client, WETH)!) - 2650)).toBeLessThan(30);
    expect(await pricer.price(client, USDC)).toBe(1);
    expect(await pricer.price(client, randomAddress(1))).toBeUndefined();
  });
});
