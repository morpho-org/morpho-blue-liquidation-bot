import {
  encodeFunctionData,
  erc20Abi,
  maxUint256,
  parseUnits,
  zeroAddress,
  type Address,
} from "viem";
import { describe, expect } from "vitest";
import { test } from "../../setup.js";
import { UniswapV3 } from "../../../src/liquidityVenues/index.js";
import { DEFAULT_ROUTER_ADDRESS } from "../../../src/liquidityVenues/uniswap/config.js";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { swapRouterAbi } from "../../../src/liquidityVenues/uniswap/abis.js";
import { readContract } from "viem/actions";

describe("uniswapV3 liquidity venue", () => {
  const USDC = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48" as Address;
  const wstETH = "0x7f39C581F595B53c5cb19bD0b3f8dA6c935E2Ca0" as Address;
  const WBTC = "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599" as Address;

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

    expect(await liquidityVenue.supportsRoute(encoder, WBTC, USDC)).toBe(true);
    await liquidityVenue.convert(encoder, {
      src: WBTC,
      dst: USDC,
      srcAmount: amount,
    });

    const calls = encoder.flush();

    expect(calls).toEqual(expectedCalls);
  });

  test.sequential("should test convert encoding execution", async ({ encoder }) => {
    const amount = parseUnits("1", 8);

    await encoder.client.deal({
      erc20: WBTC,
      account: encoder.address,
      amount: amount,
    });

    await liquidityVenue.supportsRoute(encoder, WBTC, USDC);
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
