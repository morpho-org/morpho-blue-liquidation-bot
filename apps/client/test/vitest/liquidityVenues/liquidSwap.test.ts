import { executorAbi } from "executooor-viem";
import nock from "nock";
import { Address, erc20Abi, parseUnits } from "viem";
import { readContract, writeContract } from "viem/actions";
import { describe, expect } from "vitest";

import { LiquidSwapVenue } from "../../../src/liquidityVenues/liquidSwap";
import { liquidSwapTest } from "../../setup";

const WHYPE = "0x5555555555555555555555555555555555555555" as Address;
const USDC = "0xb88339CB7199b77E23DB6E890353E22632Ba630f" as Address;

const liquidityVenue = new LiquidSwapVenue();

describe("LiquidSwap liquidity venue", () => {
  liquidSwapTest.sequential(`should test supportsRoute`, ({ encoder }) => {
    expect(liquidityVenue.supportsRoute(encoder, WHYPE, WHYPE)).toBe(false);
    expect(liquidityVenue.supportsRoute(encoder, WHYPE, USDC)).toBe(true);
    expect(liquidityVenue.supportsRoute(encoder, USDC, WHYPE)).toBe(true);
  });

  liquidSwapTest.sequential(`should test convert encoding`, async ({ encoder }) => {
    const srcAmount = parseUnits("1000", 18);

    await encoder.client.deal({
      erc20: WHYPE,
      account: encoder.address,
      amount: srcAmount,
    });

    // API response at the test block
    const calldata =
      "0xa22c27fe00000000000000000000000000000000000000000000000000000000000000e000000000000000000000000000000000000000000000003635c9adc5dea00000000000000000000000000000000000000000000000000000000000093d2f058e0000000000000000000000000000000000000000000000000000000955130d5f00000000000000000000000000000000000000000000000000000000000001400000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000020000000000000000000000005555555555555555555555555555555555555555000000000000000000000000b88339cb7199b77e23db6e890353e22632ba630f0000000000000000000000000000000000000000000000000000000000000001000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000000010000000000000000000000005555555555555555555555555555555555555555000000000000000000000000b88339cb7199b77e23db6e890353e22632ba630f000000000000000000000000000000000000000000000000000000000000000c00000000000000000000000000000000000000000000000000000000000001f400000000000000000000000000000000000000000000003635c9adc5dea000000000000000000000000000000000000000000000000000000000000000000000";
    const to = "0x744489ee3d540777a66f2cf297479745e0852f7a";

    encoder.erc20Approve(WHYPE, to, srcAmount).pushCall(to, 0n, calldata);
    const expectedCalls = encoder.flush();

    nock("https://api.liqd.ag/v2")
      .get(
        "/route?tokenIn=0x5555555555555555555555555555555555555555&tokenOut=0xb88339CB7199b77E23DB6E890353E22632Ba630f&amountIn=1000",
      )
      .reply(200, {
        success: true,
        tokens: {
          tokenIn: {
            address: "0x5555555555555555555555555555555555555555",
            symbol: "WHYPE",
            name: "Wrapped HYPE",
            decimals: 18,
          },
          tokenOut: {
            address: "0xb88339cb7199b77e23db6e890353e22632ba630f",
            symbol: "USDC",
            name: "USDC",
            decimals: 6,
          },
          intermediates: [],
        },
        amountIn: "1000",
        amountOut: "40082.017631",
        averagePriceImpact: "0.303295%",
        execution: {
          to,
          calldata,
          details: {
            path: [Array],
            amountIn: "1000000000000000000000",
            amountOut: "40082017631",
            minAmountOut: "39681197454",
            hopSwaps: [Array],
          },
        },
      });

    await liquidityVenue.convert(encoder, {
      src: WHYPE,
      dst: USDC,
      srcAmount: srcAmount,
    });

    const encodedCalls = encoder.flush();
    expect(encodedCalls).toEqual(expectedCalls);

    const functionData = {
      abi: executorAbi,
      functionName: "exec_606BaXt",
      args: [encodedCalls],
    } as const;

    const encoderUSDCBalanceBefore = await readContract(encoder.client, {
      address: USDC,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [encoder.address],
    });

    expect(encoderUSDCBalanceBefore).toBe(0n);

    await writeContract(encoder.client, { address: encoder.address, ...functionData });

    const encoderUSDCBalanceAfter = await readContract(encoder.client, {
      address: USDC,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [encoder.address],
    });

    expect(encoderUSDCBalanceAfter).toBeGreaterThan(0n);
  });
});
