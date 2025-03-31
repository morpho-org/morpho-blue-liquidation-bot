import { encodeFunctionData, erc20Abi, maxUint256, parseUnits, zeroAddress } from "viem";
import { describe, expect } from "vitest";
import { test } from "../../setup.js";
import { UniswapV3 } from "../../../src/liquidityVenues/index.js";
import { DEFAULT_ROUTER_ADDRESS } from "../../../src/liquidityVenues/uniswap/config.js";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { readContract } from "viem/actions";
import { USDC, wstETH, WBTC } from "../../constants.js";
import { swapRouterAbi } from "../../../src/liquidityVenues/uniswap/abis.js";

describe("uniswapV3 liquidity venue", () => {
  const liquidityVenue = new UniswapV3();

  test.sequential("should test supportsRoute", async ({ encoder }) => {
    expect(await liquidityVenue.supportsRoute(encoder, wstETH, USDC)).toBe(true);
    expect(await liquidityVenue.supportsRoute(encoder, USDC, zeroAddress)).toBe(false);
    expect(await liquidityVenue.supportsRoute(encoder, wstETH, zeroAddress)).toBe(false);
    expect(await liquidityVenue.supportsRoute(encoder, USDC, USDC)).toBe(false);
    expect(await liquidityVenue.supportsRoute(encoder, wstETH, wstETH)).toBe(false);
    expect(
      await liquidityVenue.supportsRoute(
        encoder,
        USDC,
        privateKeyToAccount(generatePrivateKey()).address,
      ),
    ).toBe(false);
  });

  test.sequential("should test convert encoding", async ({ encoder }) => {
    const amount = parseUnits("1", 8);

    encoder.erc20Approve(WBTC, DEFAULT_ROUTER_ADDRESS, amount);
    encoder.pushCall(
      DEFAULT_ROUTER_ADDRESS,
      0n,
      encodeFunctionData({
        abi: swapRouterAbi,
        functionName: "exactInputSingle",
        args: [
          {
            tokenIn: WBTC,
            tokenOut: USDC,
            fee: 3000,
            recipient: encoder.address,
            deadline: maxUint256,
            amountIn: amount,
            amountOutMinimum: 0n,
            sqrtPriceLimitX96: 0n,
          },
        ],
      }),
    );

    const expectedCalls = encoder.flush();

    await liquidityVenue.supportsRoute(encoder, WBTC, USDC); // Required for the pools to be cached
    const toConvert = await liquidityVenue.convert(encoder, {
      src: WBTC,
      dst: USDC,
      srcAmount: amount,
    });

    const calls = encoder.flush();

    expect(calls).toEqual(expectedCalls);
    expect(toConvert).toEqual({
      src: USDC,
      dst: USDC,
      srcAmount: 0n,
    });
  });

  test.sequential("should test convert encoding execution", async ({ encoder }) => {
    const amount = parseUnits("1", 8);

    await encoder.client.deal({
      erc20: WBTC,
      account: encoder.address,
      amount: amount,
    });

    await liquidityVenue.supportsRoute(encoder, WBTC, USDC); // Required for the pools to be cached
    await liquidityVenue.convert(encoder, {
      src: WBTC,
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
    ).toBeGreaterThan(0n);
  });
});
