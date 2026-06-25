import { executorAbi } from "executooor-viem";
import nock from "nock";
import { erc20Abi, parseUnits } from "viem";
import { readContract, writeContract } from "viem/actions";
import { describe, expect } from "vitest";

import { USDC, wstETH } from "../constants.js";
import { LiFiTest } from "../helpers.js";
import { lifiTest } from "../setup.js";

// Captured live from `GET https://li.quest/v1/quote` (chainId=1, 1 wstETH -> USDC, slippage=0.01,
// fromAddress=encoder.address, denyExchanges=<meta-aggregators>). The fork is pinned to mainnet
// block 25_352_670 (a few blocks after the API call so the route state is fresh). The encoder
// address (0x40d8...5931), baked into the calldata, matches what the `lifiTest` fixture deploys
// at that block. Meta-aggregators (1inch, 0x, paraswap, etc.) are denied at quote time because
// their inner calldata is fork-incompatible (signed/timestamped routes); Li.Fi falls back to a
// direct DEX route (here, `nordstern`).
const lifiDiamond = "0x1231DEB6f5749EF6cE6943a275A1D3E7486F4EaE";
const expectedTaker = "0x40d8d1afeed9f58b78e70c0e2c0e80008f3e5931";
const toAmount = 2_105_433_773n;
const toAmountMin = 2_084_379_435n;
const calldata =
  "0x5fd9ae2eab6f34d00dbb366f7d8436d3e31ba250338a377054867c1c55167868bea2b2dc00000000000000000000000000000000000000000000000000000000000000c0000000000000000000000000000000000000000000000000000000000000010000000000000000000000000040d8d1afeed9f58b78e70c0e2c0e80008f3e5931000000000000000000000000000000000000000000000000000000007c3d1b2b000000000000000000000000000000000000000000000000000000000000016000000000000000000000000000000000000000000000000000000000000000086c6966692d617069000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000002a30783030303030303030303030303030303030303030303030303030303030303030303030303030303000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000400000000000000000000000000000000000000000000000000000000000000200000000000000000000000000685527c551cc40ce1f1c9818cd8683307076e4ed000000000000000000000000685527c551cc40ce1f1c9818cd8683307076e4ed0000000000000000000000007f39c581f595b53c5cb19bd0b3f8da6c935e2ca00000000000000000000000007f39c581f595b53c5cb19bd0b3f8da6c935e2ca00000000000000000000000000000000000000000000000000de0b6b3a764000000000000000000000000000000000000000000000000000000000000000000e0000000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000000000a4332d746b0000000000000000000000007f39c581f595b53c5cb19bd0b3f8da6c935e2ca000000000000000000000000000000000000000000000000000000000000000400000000000000000000000000000000000000000000000000000000000000001000000000000000000000000c06ebbefd94032b85424d51906e2a335efae264b0000000000000000000000000000000000000000000000000008e1bc9bf0400000000000000000000000000000000000000000000000000000000000000000000000000000000000a929c559e5e6537359680f39cb4e3708e1a14dd1000000000000000000000000a929c559e5e6537359680f39cb4e3708e1a14dd10000000000000000000000007f39c581f595b53c5cb19bd0b3f8da6c935e2ca0000000000000000000000000a0b86991c6218b36c1d19d4a2e9eb0ce3606eb480000000000000000000000000000000000000000000000000dd7d4f70b73c00000000000000000000000000000000000000000000000000000000000000000e0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000003973f0bde2524cfec9aa0a6c2372131a0502aba6188269ab52cacb500000000000000000dd7d4f70b73c0000000000000000000000000007c3d1b2b0bec9aa0a6c2372131a0502aba6188269ab52cacb51231deb6f5749ef6ce6943a275a1d3e7486f4eae7f39c581f595b53c5cb19bd0b3f8da6c935e2ca0a0b86991c6218b36c1d19d4a2e9eb0ce3606eb48000000000004444c5dc75cb358380d2e3de08a90c02aaa39b223fe8d0a0e5c4f27ead9083c756cc228bf6006d87de7f44445905aa4f5cb8c0d8cba02e0554a476a092703abdb3ef35c80e0d76d32939f109830a1aaad605bbf02a9dfa7b0b92ec2fb7daa0000000aa232009084bd71a5797d089aa4edfad42252f216f4a494a87025123425181ca1bb754fb8fa040054037f39c581f595b53c5cb19bd0b3f8da6c935e2ca0000000000004444c5dc75cb358380d2e3de08a900000000000000000000000000000000000000000f500730001872f8a78020000006400000102f7028802ff740545070506460802f809e6060182d9de0a2ca7c3b1da0387417f70159204ce7c0eb83f054774a80ada379b4dc74eb1e0c7205a2cab9666de08069c37a813920d8b21705f3f0f9fceaba49e0571ac6296d11b0a4fc2f393c5f0348284b0ffbd7c989c17bfd1209517bb9bea9ccba597b90d80fa26a1d5e208cc4b4b16b8568ddf3fa7525436a0eb8c35a4727f730dbd7205822c1c0a9025bd98f2d07f6409f4f008b9fb7cc4357925150200e9211bace6851aa69eb96c582183def3643467f67783d8f635ae60fc3d9e7ed4dea1556642d2e67599461c0a932644880aa662c653538dd901979c66636f00db7be53e00cb1251eadc5ee7056605d7e44d5f5bbedb65b22046ef03abd1714e5b83b3aac0aa15d2fab7aa6adf1b0a5c9a6e8e603c7fcd83ae0e3fe88f32d7991e5a2fee880b5b69d4437c7835faab42a965cc91b16918b5c7a9990be79f6faab15f58da600fbe0d87d66c69238e201b0aa586438a478d2d5c3c1e451c2986eca6048a109fc9287e40e6662864709ecf9805822f914f561cf3262679b88dcf0290f9f7dd2844836078632a880055514f041cfa04007b05c02aaa39b223fe8d0a0e5c4f27ead9083c756cc2000000000004444c5dc75cb358380d2e3de08a90a0b86991c6218b36c1d19d4a2e9eb0ce3606eb480000000aa232009084bd71a5797d089aa4edfad428bf6006d87de7f44445905aa4f5cb8c0d8cba02f5007100018a78020080000000000a03f702890204fff90ffafaea67316a900301ff000000000000000000";

describe("lifi liquidity venue", () => {
  const liquidityVenue = new LiFiTest([1]);

  lifiTest.sequential("should test supportsRoute", ({ encoder }) => {
    expect(liquidityVenue.supportsRoute(encoder, wstETH, USDC)).toBe(true);
  });

  lifiTest.sequential("should execute swap via Li.Fi Diamond", async ({ encoder }) => {
    // Sanity: the captured calldata embeds this taker. Fixture must deploy the executor here.
    expect(encoder.address.toLowerCase()).toBe(expectedTaker);

    encoder
      .erc20Approve(wstETH, lifiDiamond, parseUnits("1", 18))
      .pushCall(lifiDiamond, 0n, calldata);

    const expectedCalls = encoder.flush();

    nock("https://li.quest")
      .get("/v1/quote")
      .query(true)
      .reply(200, {
        tool: "nordstern",
        action: {
          fromChainId: 1,
          toChainId: 1,
          fromToken: { address: wstETH },
          toToken: { address: USDC },
          fromAmount: "1000000000000000000",
          slippage: 0.01,
        },
        estimate: {
          approvalAddress: lifiDiamond,
          fromAmount: "1000000000000000000",
          toAmount: toAmount.toString(),
          toAmountMin: toAmountMin.toString(),
          executionDuration: 30,
        },
        transactionRequest: {
          to: lifiDiamond,
          data: calldata,
          value: "0x0",
          chainId: 1,
          gasLimit: "0x6a808",
          gasPrice: "0x1357a762",
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

    const [usdcBefore, wstETHBefore] = await Promise.all([
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

    expect(usdcBefore).toBe(0n);
    expect(wstETHBefore).toBe(parseUnits("1", 18));

    await writeContract(encoder.client, {
      address: encoder.address,
      abi: executorAbi,
      functionName: "exec_606BaXt",
      args: [encodedCalls],
    });

    const [usdcAfter, wstETHAfter] = await Promise.all([
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

    expect(usdcAfter).toBeGreaterThanOrEqual(toAmountMin);
    expect(wstETHAfter).toBe(0n);
  });
});
