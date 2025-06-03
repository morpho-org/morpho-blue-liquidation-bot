import { MIN_SQRT_RATIO } from "@morpho-blue-liquidation-bot/config";
import { executorAbi } from "executooor-viem";
import { encodeAbiParameters, encodeFunctionData, erc20Abi, parseUnits, zeroAddress } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { readContract } from "viem/actions";
import { describe, expect } from "vitest";

import { uniswapV3PoolAbi } from "../../../src/abis/uniswapV3.js";
import { UniswapV3Venue } from "../../../src/liquidityVenues/index.js";
import { USDC, wstETH, WBTC } from "../../constants.js";
import { encoderTest } from "../../setup.js";

describe("uniswapV3 liquidity venue", () => {
  const liquidityVenue = new UniswapV3Venue();

  encoderTest.sequential("should test supportsRoute", async ({ encoder }) => {
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

  encoderTest.sequential("should test convert encoding", async ({ encoder }) => {
    const amount = parseUnits("1", 8);

    const encodedContext =
      `0x${0n.toString(16).padStart(24, "0") + zeroAddress.substring(2)}` as const;
    const callbacks = [
      encodeFunctionData({
        abi: executorAbi,
        functionName: "call_g0oyU7o",
        args: [
          WBTC,
          0n,
          encodedContext,
          encodeFunctionData({
            abi: erc20Abi,
            functionName: "transfer",
            args: ["0x99ac8cA7087fA4A2A1FB6357269965A2014ABc35", amount],
          }),
        ],
      }),
    ];

    encoder.pushCall(
      "0x99ac8cA7087fA4A2A1FB6357269965A2014ABc35",
      0n,
      encodeFunctionData({
        abi: uniswapV3PoolAbi,
        functionName: "swap",
        args: [
          encoder.address,
          true,
          amount,
          MIN_SQRT_RATIO + 1n,
          encodeAbiParameters([{ type: "bytes[]" }, { type: "bytes" }], [callbacks, "0x"]),
        ],
      }),
      {
        sender: "0x99ac8cA7087fA4A2A1FB6357269965A2014ABc35",
        dataIndex: 2n,
      },
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

  encoderTest.sequential("should test convert encoding execution", async ({ encoder }) => {
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
