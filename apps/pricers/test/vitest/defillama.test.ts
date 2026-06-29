import { describe, expect, beforeEach, it } from "vitest";

import { DEFILLAMA_CHAIN_SLUGS, DefiLlamaPricer } from "../../src";
import { WBTC, USDC, WETH, USDC_BASE } from "../constants.js";
import { test } from "../setup.js";

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

  describe("DEFILLAMA_CHAIN_SLUGS", () => {
    it.each([
      [1, "ethereum"],
      [8453, "base"],
      [42161, "arbitrum"],
      [130, "unichain"],
      [137, "polygon"],
      [747474, "katana"],
      [999, "hyperliquid"],
      [143, "monad"],
      [480, "wc"],
    ])("maps chain %i to slug %s", (chainId, slug) => {
      expect(DEFILLAMA_CHAIN_SLUGS[chainId]).toBe(slug);
    });
  });
});
