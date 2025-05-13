import { base, mainnet, sepolia } from "viem/chains";
import { describe, expect } from "vitest";
import { test } from "../../setup.js";
import { MorphoApi } from "../../../src/pricers/index.js";
import { WBTC, USDC, USDC_BASE } from "../../constants.js";
import { randomAddress } from "@morpho-org/test";

describe("morpho api pricer", () => {
  const pricer = new MorphoApi();

  test.sequential("should test supportsChain", async ({ encoder }) => {
    expect(await pricer.supportsChain(mainnet.id)).toBe(true);
    expect(await pricer.supportsChain(base.id)).toBe(true);
    expect(await pricer.supportsChain(sepolia.id)).toBe(false);
    expect(await pricer.supportsChain(0)).toBe(false);
  });

  test.sequential("should test price", async ({ encoder }) => {
    expect((await pricer.price(encoder.client, mainnet.id, USDC)!) - 1).toBeLessThan(0.1);
    console.log(await pricer.price(encoder.client, base.id, USDC_BASE));
    expect((await pricer.price(encoder.client, base.id, USDC_BASE)!) - 1).toBeLessThan(0.1);
    expect(await pricer.price(encoder.client, mainnet.id, WBTC)).toBeGreaterThan(0);
    expect(await pricer.price(encoder.client, mainnet.id, randomAddress(1))).toBeUndefined();
  });
});
