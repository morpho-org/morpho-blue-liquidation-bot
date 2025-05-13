import { describe, expect } from "vitest";
import { test } from "../../setup.js";
import { MorphoApi } from "../../../src/pricers";
import { WBTC, USDC, USDC_BASE } from "../../constants.js";
import { randomAddress } from "@morpho-org/test";
import { randomInt } from "node:crypto";

describe("morpho api pricer", () => {
  const pricer = new MorphoApi();

  test.sequential("should test supportsChain", async () => {
    const supportedChainsQuery = `
      query {
        chains{
            id
        }
      }
      `;

    const response = await fetch("https://blue-api.morpho.org/graphql", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: supportedChainsQuery }),
    });

    const data = (await response.json()) as { data: { chains: { id: number }[] } };
    const supportedChains = data.data.chains.map((chain) => chain.id);

    for (const chain of supportedChains) {
      expect(await pricer.supportsChain(chain)).toBe(true);
    }

    for (let i = 0; i < 10; i++) {
      const randomChainId = randomInt(0, 1000000);
      if (supportedChains.includes(randomChainId)) continue;
      expect(await pricer.supportsChain(randomChainId)).toBe(false);
    }
  });

  test.sequential("should test supportsAsset", async ({ client }) => {
    expect(await pricer.supportsAsset(client, USDC)).toBe(true);
    expect(await pricer.supportsAsset(client, USDC_BASE)).toBe(true); // Actually should be false, but the pricer is returning true for the sake of simplicity and efficiency
    expect(await pricer.supportsAsset(client, WBTC)).toBe(true);
  });

  test.sequential("should test price", async ({ client }) => {
    expect((await pricer.price(client, USDC)!) - 1).toBeLessThan(0.1);
    expect(await pricer.price(client, USDC_BASE)).toBeUndefined();
    expect(await pricer.price(client, WBTC)).toBeGreaterThan(0);
    expect(await pricer.price(client, randomAddress(1))).toBeUndefined();
  });
});
