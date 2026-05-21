import { encodeFunctionData, erc20Abi, parseUnits } from "viem";
import { readContract } from "viem/actions";
import { describe, expect } from "vitest";

import { daiUsdsConverterAbi, mkrSkyConverterAbi } from "../../src/abis/sky";
import { Sky } from "../../src/sky";
import {
  DAI,
  DAI_USDS_CONVERTER,
  MKR,
  MKR_SKY_CONVERTER,
  SKY,
  USDC,
  USDS,
  WBTC,
} from "../constants";
import { encoderTest } from "../setup";

describe("Sky liquidity venue", () => {
  const venue = new Sky();

  encoderTest.sequential("supportsRoute — USDS↔DAI and SKY↔MKR pairs", ({ encoder }) => {
    // Direct alternative pairs: always supported.
    expect(venue.supportsRoute(encoder, USDS, DAI)).toBe(true);
    expect(venue.supportsRoute(encoder, DAI, USDS)).toBe(true);
    expect(venue.supportsRoute(encoder, SKY, MKR)).toBe(true);
    expect(venue.supportsRoute(encoder, MKR, SKY)).toBe(true);

    // src === dst → never supported.
    expect(venue.supportsRoute(encoder, USDS, USDS)).toBe(false);
    expect(venue.supportsRoute(encoder, DAI, DAI)).toBe(false);

    // "Wrapped" sides (USDS, SKY) prefer the alternative even for unrelated dst —
    // so DAI/MKR routes open up downstream.
    expect(venue.supportsRoute(encoder, USDS, USDC)).toBe(true);
    expect(venue.supportsRoute(encoder, USDS, WBTC)).toBe(true);
    expect(venue.supportsRoute(encoder, SKY, USDC)).toBe(true);

    // "Main" sides (DAI, MKR) don't redirect when dst isn't their pair —
    // let the aggregator handle DAI/MKR directly.
    expect(venue.supportsRoute(encoder, DAI, USDC)).toBe(false);
    expect(venue.supportsRoute(encoder, MKR, USDC)).toBe(false);

    // Non-Sky tokens are never claimed.
    expect(venue.supportsRoute(encoder, USDC, USDS)).toBe(false);
    expect(venue.supportsRoute(encoder, WBTC, DAI)).toBe(false);
  });

  encoderTest.sequential("convert USDS → DAI emits the expected calls", async ({ encoder }) => {
    const amount = parseUnits("10000", 18);

    encoder.erc20Approve(USDS, DAI_USDS_CONVERTER, amount).pushCall(
      DAI_USDS_CONVERTER,
      0n,
      encodeFunctionData({
        abi: daiUsdsConverterAbi,
        functionName: "usdsToDai",
        args: [encoder.address, amount],
      }),
    );
    const expectedCalls = encoder.flush();

    const result = await venue.convert(encoder, { src: USDS, dst: DAI, srcAmount: amount });
    const encodedCalls = encoder.flush();

    expect(encodedCalls).toEqual(expectedCalls);
    expect(result).toEqual({ src: DAI, dst: DAI, srcAmount: amount });
  });

  encoderTest.sequential("convert DAI → USDS emits the expected calls", async ({ encoder }) => {
    const amount = parseUnits("5000", 18);

    encoder.erc20Approve(DAI, DAI_USDS_CONVERTER, amount).pushCall(
      DAI_USDS_CONVERTER,
      0n,
      encodeFunctionData({
        abi: daiUsdsConverterAbi,
        functionName: "daiToUsds",
        args: [encoder.address, amount],
      }),
    );
    const expectedCalls = encoder.flush();

    const result = await venue.convert(encoder, { src: DAI, dst: USDS, srcAmount: amount });
    const encodedCalls = encoder.flush();

    expect(encodedCalls).toEqual(expectedCalls);
    expect(result).toEqual({ src: USDS, dst: USDS, srcAmount: amount });
  });

  encoderTest.sequential(
    "convert USDS → DAI executes on-chain and yields 1:1 DAI",
    async ({ encoder }) => {
      const amount = parseUnits("10000", 18);

      await encoder.client.deal({ erc20: USDS, account: encoder.address, amount });

      await venue.convert(encoder, { src: USDS, dst: DAI, srcAmount: amount });
      await encoder.exec();

      const [usdsBalance, daiBalance] = await Promise.all([
        readContract(encoder.client, {
          address: USDS,
          abi: erc20Abi,
          functionName: "balanceOf",
          args: [encoder.address],
        }),
        readContract(encoder.client, {
          address: DAI,
          abi: erc20Abi,
          functionName: "balanceOf",
          args: [encoder.address],
        }),
      ]);

      expect(usdsBalance).toBe(0n);
      expect(daiBalance).toBe(amount);
    },
  );

  encoderTest.sequential(
    "convert SKY → MKR returns rate-scaled output and executes",
    async ({ encoder }) => {
      const skyAmount = parseUnits("48000", 18); // expect 2 MKR (rate = 24000)

      const rate = await readContract(encoder.client, {
        address: MKR_SKY_CONVERTER,
        abi: mkrSkyConverterAbi,
        functionName: "rate",
      });
      const expectedMkr = skyAmount / rate;

      await encoder.client.deal({ erc20: SKY, account: encoder.address, amount: skyAmount });

      const result = await venue.convert(encoder, { src: SKY, dst: MKR, srcAmount: skyAmount });
      expect(result).toEqual({ src: MKR, dst: MKR, srcAmount: expectedMkr });

      await encoder.exec();

      const [skyBalance, mkrBalance] = await Promise.all([
        readContract(encoder.client, {
          address: SKY,
          abi: erc20Abi,
          functionName: "balanceOf",
          args: [encoder.address],
        }),
        readContract(encoder.client, {
          address: MKR,
          abi: erc20Abi,
          functionName: "balanceOf",
          args: [encoder.address],
        }),
      ]);

      expect(skyBalance).toBe(0n);
      expect(mkrBalance).toBe(expectedMkr);
    },
  );
});
