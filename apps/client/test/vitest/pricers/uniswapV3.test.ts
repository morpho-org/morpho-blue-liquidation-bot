import { randomAddress } from "@morpho-org/test";
import { checksumAddress } from "viem";
import { describe, expect } from "vitest";

import { UniswapV3Pricer } from "../../../src/pricers";
import { WBTC, USDC, WETH } from "../../constants.js";
import { test } from "../../setup.js";

describe("morpho api pricer", () => {
  const pricer = new UniswapV3Pricer();

  test.sequential("should test price", async ({ client }) => {
    /// Prices at the time of the fork
    expect(Math.abs((await pricer.price(client, WBTC)) - 68000)).toBeLessThan(1000);
    expect(Math.abs((await pricer.price(client, WETH)) - 2650)).toBeLessThan(30);
    expect(await pricer.price(client, USDC)).toBe(1);
    expect(await pricer.price(client, checksumAddress(randomAddress(1)))).toBeUndefined();
  });
});
