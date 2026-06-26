import { erc20Abi, erc4626Abi, parseUnits } from "viem";
import { describe, expect } from "vitest";
import { encoderTest } from "../../setup.js";
import { Erc4626 } from "../../../src/liquidityVenues/index.js";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { readContract } from "viem/actions";
import { steakUSDC, WBTC, USDC } from "../../constants.js";

describe("erc4626 liquidity venue", () => {
  const liquidityVenue = new Erc4626();

  encoderTest.sequential("should test supportsRoute", async ({ encoder }) => {
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

  encoderTest.sequential("should test convert encoding", async ({ encoder }) => {
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

  encoderTest.sequential("should test convert encoding execution", async ({ encoder }) => {
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
