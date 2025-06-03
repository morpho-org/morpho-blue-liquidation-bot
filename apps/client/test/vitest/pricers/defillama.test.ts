import { describe, expect, beforeEach } from "vitest";

import { DefiLlamaPricer } from "../../../src/pricers";
import { WBTC, USDC, WETH, USDC_BASE } from "../../constants.js";
import { test } from "../../setup.js";

describe("defillama pricer", () => {
  let pricer: DefiLlamaPricer;

  beforeEach(() => {
    pricer = new DefiLlamaPricer();
  });

  test("should test price", async ({ client }) => {
    expect(await pricer.price(client, USDC_BASE)).toBe(undefined);
    expect(Math.floor(Math.log10(await pricer.price(client, WETH)))).toBeCloseTo(3);
    expect(Math.log10(await pricer.price(client, WBTC))).toBeGreaterThan(4);
    expect(await pricer.price(client, USDC)).toBeCloseTo(1, 3);
  });
});
