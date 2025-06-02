import { erc20Abi, parseUnits } from "viem";
import { readContract } from "viem/actions";
import { describe, expect } from "vitest";

import { UniswapV4Venue } from "../../../src/liquidityVenues/uniswapV4/index.js";
import { USDC, WBTC, WETH } from "../../constants.js";
import { encoderTestLaterBlock as encoderTest } from "../../setup.js";

// NOTE: If you have issue running this, check https://github.com/Uniswap/sdks/issues/227
describe("uniswapV4 liquidity venue", () => {
  const liquidityVenue = new UniswapV4Venue();

  encoderTest.sequential("should swap WBTC to USDC", async ({ encoder }) => {
    const src = WBTC;
    const dst = USDC;
    const srcAmount = parseUnits("1", 8);
    const dstAmount = parseUnits("108071.080431", 6);

    await encoder.client.deal({
      erc20: src,
      account: encoder.address,
      amount: srcAmount,
    });

    await liquidityVenue.supportsRoute(encoder, src, dst);
    const remaining = await liquidityVenue.convert(encoder, { src, dst, srcAmount });

    expect(remaining.srcAmount).toBe(0n);

    await encoder.exec();

    expect(
      await readContract(encoder.client, {
        address: dst,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [encoder.address],
      }),
    ).toBe(dstAmount);
  });

  encoderTest.sequential("should swap USDC to WBTC", async ({ encoder }) => {
    const src = USDC;
    const dst = WBTC;
    const srcAmount = parseUnits("100000", 6);
    const dstAmount = parseUnits("0.91513079", 8);

    await encoder.client.deal({
      erc20: src,
      account: encoder.address,
      amount: srcAmount,
    });

    await liquidityVenue.supportsRoute(encoder, src, dst);
    const remaining = await liquidityVenue.convert(encoder, { src, dst, srcAmount });

    expect(remaining.srcAmount).toBe(0n);

    await encoder.exec();

    expect(
      await readContract(encoder.client, {
        address: dst,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [encoder.address],
      }),
    ).toBe(dstAmount);
  });

  encoderTest.sequential("should swap USDC to WETH (handling wrapping)", async ({ encoder }) => {
    const src = USDC;
    const dst = WETH;
    const srcAmount = parseUnits("4000", 6);
    const dstAmount = parseUnits("1.482797993339219646", 18);

    await encoder.client.deal({
      erc20: src,
      account: encoder.address,
      amount: srcAmount,
    });

    await liquidityVenue.supportsRoute(encoder, src, dst);
    const remaining = await liquidityVenue.convert(encoder, { src, dst, srcAmount });

    expect(remaining.srcAmount).toBe(0n);

    await encoder.exec();

    expect(
      await readContract(encoder.client, {
        address: dst,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [encoder.address],
      }),
    ).toBe(dstAmount);
  });

  encoderTest.sequential("should swap WETH to USDC (handling unwrapping)", async ({ encoder }) => {
    const src = WETH;
    const dst = USDC;
    const srcAmount = parseUnits("1", 18);
    const dstAmount = parseUnits("2694.818255", 6);

    await encoder.client.deal({
      erc20: src,
      account: encoder.address,
      amount: srcAmount,
    });

    await liquidityVenue.supportsRoute(encoder, src, dst);
    const remaining = await liquidityVenue.convert(encoder, { src, dst, srcAmount });

    expect(remaining.srcAmount).toBe(0n);

    await encoder.exec();

    expect(
      await readContract(encoder.client, {
        address: dst,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [encoder.address],
      }),
    ).toBe(dstAmount);
  });
});
