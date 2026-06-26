import { executorAbi } from "executooor-viem";
import { Address, encodeFunctionData, erc20Abi, parseUnits } from "viem";
import { readContract, writeContract } from "viem/actions";
import { describe, expect } from "vitest";

import { MidasVenue } from "../../../src/liquidityVenues/midas";
import { USDC, WBTC } from "../../constants";
import { midasTest } from "../../setup";
import { redemptionVaultAbi } from "../../../src/abis/midas";

const collateral = "0xDD629E5241CbC5919847783e6C96B2De4754e438" as Address; // mTBILL
const redemptionVault = "0x569D7dccBF6923350521ecBC28A555A500c4f0Ec" as Address;

const collateralAmount = parseUnits("10000", 18);
const liquidityVenue = new MidasVenue();

describe("Midas liquidity venue", () => {
  midasTest.sequential(`should test supportsRoute`, async ({ encoder }) => {
    expect(liquidityVenue.supportsRoute(encoder, collateral, collateral)).toBe(false);
    expect(liquidityVenue.supportsRoute(encoder, collateral, USDC)).toBe(true);
    expect(liquidityVenue.supportsRoute(encoder, WBTC, collateral)).toBe(false);
  });

  midasTest.sequential(
    `should swap a PT token to the underlying token market before maturity`,
    async ({ encoder }) => {
      const redemptionParams = await liquidityVenue.getRedemptionParams(
        redemptionVault,
        USDC,
        collateralAmount,
        encoder,
      );

      const previewRedeemInstantData = liquidityVenue.previewRedeemInstant(redemptionParams!);

      const { amountTokenOutWithoutFee, feeAmount } = previewRedeemInstantData!;

      encoder.erc20Approve(collateral, redemptionVault, feeAmount);

      encoder.pushCall(
        redemptionVault,
        0n,
        encodeFunctionData({
          abi: redemptionVaultAbi,
          functionName: "redeemInstant",
          args: [USDC, collateralAmount, amountTokenOutWithoutFee],
        }),
      );

      const expectedCalls = encoder.flush();

      await encoder.client.deal({
        erc20: collateral,
        account: encoder.address,
        amount: collateralAmount,
      });

      // overwrite data feeds healthy diff slot to make the price feed healthy in the future

      await liquidityVenue.convert(encoder, {
        src: collateral,
        dst: USDC,
        srcAmount: collateralAmount,
      });

      const encodedCalls = encoder.flush();

      expect(encodedCalls).toEqual(expectedCalls);

      await encoder.client.deal({
        erc20: collateral,
        account: encoder.address,
        amount: collateralAmount,
      });

      const [encoderCollateralBalanceBefore, encoderUnderlyingBalanceBefore] = await Promise.all([
        readContract(encoder.client, {
          address: collateral,
          abi: erc20Abi,
          functionName: "balanceOf",
          args: [encoder.address],
        }),
        readContract(encoder.client, {
          address: USDC,
          abi: erc20Abi,
          functionName: "balanceOf",
          args: [encoder.address],
        }),
      ]);

      expect(encoderCollateralBalanceBefore).toBe(collateralAmount);
      expect(encoderUnderlyingBalanceBefore).toBe(0n);

      const functionData = {
        abi: executorAbi,
        functionName: "exec_606BaXt",
        args: [encodedCalls],
      } as const;

      await writeContract(encoder.client, { address: encoder.address, ...functionData });

      const [encoderCollateralBalanceAfter, encoderUnderlyingBalanceAfter] = await Promise.all([
        readContract(encoder.client, {
          address: collateral,
          abi: erc20Abi,
          functionName: "balanceOf",
          args: [encoder.address],
        }),
        readContract(encoder.client, {
          address: USDC,
          abi: erc20Abi,
          functionName: "balanceOf",
          args: [encoder.address],
        }),
      ]);

      expect(encoderCollateralBalanceAfter).toBe(0n);
      expect(encoderUnderlyingBalanceAfter).toBeGreaterThanOrEqual(0n);
    },
  );
});
