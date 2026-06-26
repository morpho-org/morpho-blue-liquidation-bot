import { describe, expect } from "vitest";

import { ChainlinkPricer } from "../../../src/pricers";
import { WBTC, USDC, WETH } from "../../constants.js";
import { test } from "../../setup.js";

describe("chainlink pricer", () => {
  test("should return price on Ethereum mainnet", async ({ client }) => {
    const pricer = new ChainlinkPricer();

    const wethPrice = await pricer.price(client, WETH);
    expect(wethPrice !== undefined).toBeTruthy();
    expect(wethPrice).toBeGreaterThan(1000);

    const wbtcPrice = await pricer.price(client, WBTC);
    expect(wbtcPrice !== undefined).toBeTruthy();
    expect(wbtcPrice).toBeGreaterThan(20000);

    const usdcPrice = await pricer.price(client, USDC);
    expect(usdcPrice !== undefined).toBeTruthy();
    expect(usdcPrice).toBeCloseTo(1, 3);
  });
});
