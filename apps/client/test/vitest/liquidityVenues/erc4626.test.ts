import { erc20Abi, erc4626Abi, parseUnits, type Address } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { readContract } from "viem/actions";
import { describe, expect } from "vitest";

import { Erc4626 } from "../../../src/liquidityVenues/index.js";
import { test } from "../../setup.js";

describe("erc4626 liquidity venue", () => {
  const USDC = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48" as Address;
  const WBTC = "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599" as Address;
  const steakUSDC = "0xBEEF01735c132Ada46AA9aA4c54623cAA92A64CB" as Address;

  const liquidityVenue = new Erc4626();

  test.sequential("should test supportsRoute", async ({ encoder }) => {
    expect(await liquidityVenue.supportsRoute(encoder, WBTC, USDC)).toBe(false);
    expect(await liquidityVenue.supportsRoute(encoder, steakUSDC, steakUSDC)).toBe(false);
    expect(await liquidityVenue.supportsRoute(encoder, USDC, steakUSDC)).toBe(false);
    expect(await liquidityVenue.supportsRoute(encoder, steakUSDC, USDC)).toBe(true);
    expect(await liquidityVenue.supportsRoute(encoder, steakUSDC, WBTC)).toBe(true);
    expect(
      await liquidityVenue.supportsRoute(
        encoder,
        privateKeyToAccount(generatePrivateKey()).address,
        USDC,
      ),
    ).toBe(false);
  });

  test.sequential("should test convert encoding", async ({ encoder }) => {
    const amount = parseUnits("10000", 18);

    encoder.erc4626Redeem(steakUSDC, amount, encoder.address, encoder.address);
    const expectedCalls = encoder.flush();

    await liquidityVenue.supportsRoute(encoder, steakUSDC, USDC); // Required for the underlying to be cached
    const toConvert = await liquidityVenue.convert(encoder, {
      src: steakUSDC,
      dst: USDC,
      srcAmount: amount,
    });

    const calls = encoder.flush();

    expect(calls).toEqual(expectedCalls);
    expect(toConvert).toEqual({
      src: USDC,
      dst: USDC,
      srcAmount: await readContract(encoder.client, {
        address: steakUSDC,
        abi: erc4626Abi,
        functionName: "previewRedeem",
        args: [amount],
      }),
    });
  });

  test.sequential("should test convert encoding execution", async ({ encoder }) => {
    const amount = parseUnits("10000", 18);

    await encoder.client.deal({
      erc20: steakUSDC,
      account: encoder.address,
      amount: amount,
    });

    await liquidityVenue.supportsRoute(encoder, steakUSDC, USDC); // Required for the underlying to be cached
    const toConvert = await liquidityVenue.convert(encoder, {
      src: steakUSDC,
      dst: USDC,
      srcAmount: amount,
    });

    await encoder.exec();

    expect(
      await readContract(encoder.client, {
        address: USDC,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [encoder.address],
      }),
    ).toBeGreaterThanOrEqual(toConvert.srcAmount); // Not strictly equal because of roundings
  });
});
