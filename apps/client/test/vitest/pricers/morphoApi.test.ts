import { describe, expect } from "vitest";
import { test } from "../../setup.js";
import { MorphoApi } from "../../../src/pricers";
import { WBTC, USDC, USDC_BASE } from "../../constants.js";
import { randomAddress } from "@morpho-org/test";

describe("morpho api pricer", () => {
  const pricer = new MorphoApi();

  test.sequential("should test price", async ({ client }) => {
    expect((await pricer.price(client, USDC)!) - 1).toBeLessThan(0.1);
    expect(await pricer.price(client, USDC_BASE)).toBeUndefined();
    expect(await pricer.price(client, WBTC)).toBeGreaterThan(0);
    expect(await pricer.price(client, randomAddress(1))).toBeUndefined();
  });
});
