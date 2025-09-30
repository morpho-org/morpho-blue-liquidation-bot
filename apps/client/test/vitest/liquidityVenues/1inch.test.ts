import { executorAbi } from "executooor-viem";
import nock from "nock";
import { erc20Abi, parseUnits } from "viem";
import { readContract, writeContract } from "viem/actions";
import { describe, expect } from "vitest";

import { OneInch } from "../../../src/liquidityVenues/1inch/index.js";
import { USDC, wstETH } from "../../constants.js";
import { oneInchTest } from "../../setup.js";

describe("1inch liquidity venue", () => {
  const liquidityVenue = new OneInch();

  // data from 1inch swap API at test block
  const one1inchData =
    "0x07ed23790000000000000000000000005141b82f5ffda4c6fe1e372978f1c5427640a1900000000000000000000000007f39c581f595b53c5cb19bd0b3f8da6c935e2ca0000000000000000000000000a0b86991c6218b36c1d19d4a2e9eb0ce3606eb480000000000000000000000005141b82f5ffda4c6fe1e372978f1c5427640a19000000000000000000000000082f3c3a79fd86895ef7fa87c61a914d266e6fb5e0000000000000000000000000000000000000000000000000de0b6b3a76400000000000000000000000000000000000000000000000000000000000127c8f6450000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000012000000000000000000000000000000000000000000000000000000000000003350000000000000000000000000000000003170001670001180000fe00004e00a0744c8c097f39c581f595b53c5cb19bd0b3f8da6c935e2ca090cbe4bdd538d6e9b379bff5fe72c3d67a521de5000000000000000000000000000000000000000000000000000aa87bee53800051200b1a513ee24972daef112bc777a5610d4325c9e77f39c581f595b53c5cb19bd0b3f8da6c935e2ca000242668dfaa0000000000000000000000000000000000000000000000000000000000000001000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000010a46a6224065a900000000000000000000000005141b82f5ffda4c6fe1e372978f1c5427640a1904041c02aaa39b223fe8d0a0e5c4f27ead9083c756cc2d0e30db002a00000000000000000000000000000000000000000000000000000000127982147ee63c1e501c7bbec68d12a0d1830360f8ec58fa599ba1b0e9bc02aaa39b223fe8d0a0e5c4f27ead9083c756cc25120bbcb91440523216e2b87052a99f69c604a7b6e00dac17f958d2ee523a2206206994597c13d831ec700847fc9d4ad000000000000000000000000a0b86991c6218b36c1d19d4a2e9eb0ce3606eb48000000000000000000000000dac17f958d2ee523a2206206994597c13d831ec70000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000127c8f645000000000000000000000000111111125421ca6dc452d289314280a0f8842a65000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000001400000000000000000000000000000000000000000000000000000000000000160000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000d1e8116e";
  const dstAmount = "5012574713";

  const one1inchContract = "0x111111125421cA6dc452d289314280a0f8842A65";

  oneInchTest.sequential("should test convert", async ({ encoder }) => {
    encoder
      .erc20Approve(wstETH, one1inchContract, parseUnits("1", 18))
      .pushCall(one1inchContract, 0n, one1inchData);

    const expectedCalls = encoder.flush();

    nock("https://api.1inch.dev")
      .get("/swap/v6.0/1/swap")
      .query({
        chainId: "1",
        src: wstETH,
        dst: USDC,
        amount: "1000000000000000000",
        from: encoder.address,
        slippage: "1",
        origin: encoder.client.account.address,
        includeTokensInfo: "false",
        includeProtocols: "false",
        includeGas: "false",
        allowPartialFill: "false",
        disableEstimate: "true",
        usePermit2: "false",
      })
      .reply(200, {
        dstAmount: "5012574713",
        tx: {
          from: "0x82f3c3a79fd86895ef7fa87c61a914d266e6fb5e",
          to: one1inchContract,
          data: one1inchData,
          value: "0",
          gas: 0,
          gasPrice: "1469352523",
        },
      });

    await liquidityVenue.convert(encoder, {
      src: wstETH,
      dst: USDC,
      srcAmount: parseUnits("1", 18),
    });

    const encodedCalls = encoder.flush();

    expect(encodedCalls).toEqual(expectedCalls);

    await encoder.client.deal({
      erc20: wstETH,
      account: encoder.address,
      amount: parseUnits("1", 18),
    });

    const [encoderUSDBalanceBefore, encoderWstETHBalanceBefore] = await Promise.all([
      readContract(encoder.client, {
        address: USDC,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [encoder.address],
      }),
      readContract(encoder.client, {
        address: wstETH,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [encoder.address],
      }),
    ]);

    expect(encoderUSDBalanceBefore).toBe(0n);
    expect(encoderWstETHBalanceBefore).toBe(parseUnits("1", 18));

    const functionData = {
      abi: executorAbi,
      functionName: "exec_606BaXt",
      args: [encodedCalls],
    } as const;

    await writeContract(encoder.client, { address: encoder.address, ...functionData });

    const [encoderUSDBalanceAfter, encoderWstETHBalanceAfter] = await Promise.all([
      readContract(encoder.client, {
        address: USDC,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [encoder.address],
      }),
      readContract(encoder.client, {
        address: wstETH,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [encoder.address],
      }),
    ]);

    expect(encoderUSDBalanceAfter).toBeGreaterThanOrEqual(BigInt(dstAmount));
    expect(encoderWstETHBalanceAfter).toBe(0n);
  });
});
