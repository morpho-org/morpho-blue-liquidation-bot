import { describe, expect, beforeEach } from "vitest";

import { DefiLlamaPricer } from "../../../src/pricers";
import { WBTC, USDC, WETH, USDC_BASE } from "../../constants.js";
import { test } from "../../setup.js";

describe("defillama pricer", () => {
  let pricer: DefiLlamaPricer;

  beforeEach(() => {
    pricer = new DefiLlamaPricer();
  });

  test("should test supportsAsset", async ({ client }) => {
    expect(await pricer.supportsAsset(client, WETH)).toBe(true);
    expect(await pricer.supportsAsset(client, WBTC)).toBe(true);
    expect(await pricer.supportsAsset(client, USDC)).toBe(true);
    expect(await pricer.supportsAsset(client, USDC_BASE)).toBe(false);
  });

  test("should test price", async ({ client }) => {
    expect(Math.floor(Math.log10(await pricer.price(client, WETH)))).toBeCloseTo(3);
    expect(Math.log10(await pricer.price(client, WBTC))).toBeGreaterThan(4);
    expect(await pricer.price(client, USDC)).toBeCloseTo(1, 3);
  });
});
