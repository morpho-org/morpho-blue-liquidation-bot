import { erc20Abi, maxUint256, parseUnits } from "viem";
import { describe, expect } from "vitest";
import { testAccount } from "@morpho-org/test";

import { MORPHO, wbtcUSDC } from "../../../client/test/constants.js";
import { overwriteCollateral } from "../../../client/test/helpers.js";
import { adaptiveCurveIrmAbi } from "../../abis/AdaptiveCurveIrm";
import { morphoBlueAbi } from "../../abis/MorphoBlue.js";
import { oracleAbi } from "../../abis/Oracle";
import { accrueInterest, borrowRate, getLiquidationData, wMulDown } from "../../src/api/helpers";
import { helpersTest } from "../setup";
import { formatMarketState, formatPosition } from "../helpers.js";
import { setupBorrow } from "../helpers.js";

describe("Helpers", () => {
  const borrower = testAccount(1);

  helpersTest.sequential("should accrue interests", async ({ client }) => {
    const [_marketParams, _marketState] = await Promise.all([
      client.readContract({
        address: MORPHO,
        abi: morphoBlueAbi,
        functionName: "idToMarketParams",
        args: [wbtcUSDC],
      }),
      client.readContract({
        address: MORPHO,
        abi: morphoBlueAbi,
        functionName: "market",
        args: [wbtcUSDC],
      }),
    ]);

    const marketParams = {
      loanToken: _marketParams[0],
      collateralToken: _marketParams[1],
      oracle: _marketParams[2],
      irm: _marketParams[3],
      lltv: _marketParams[4],
    };

    const marketState = {
      totalSupplyAssets: _marketState[0],
      totalSupplyShares: _marketState[1],
      totalBorrowAssets: _marketState[2],
      totalBorrowShares: _marketState[3],
      lastUpdate: _marketState[4],
      fee: _marketState[5],
    };

    const timestamp = await client.timestamp();

    expect(marketState.lastUpdate).toBeLessThan(timestamp);

    const rateAtTarget = await client.readContract({
      address: marketParams.irm,
      abi: adaptiveCurveIrmAbi,
      functionName: "rateAtTarget",
      args: [wbtcUSDC],
    });

    const onchainBorrowRate = await client.readContract({
      address: marketParams.irm,
      abi: adaptiveCurveIrmAbi,
      functionName: "borrowRateView",
      args: [marketParams, marketState],
    });

    expect(borrowRate(marketState, rateAtTarget, timestamp)).toBe(onchainBorrowRate);

    await client.writeContract({
      address: MORPHO,
      abi: morphoBlueAbi,
      functionName: "accrueInterest",
      args: [marketParams],
    });

    const newMarketState = await client.readContract({
      address: MORPHO,
      abi: morphoBlueAbi,
      functionName: "market",
      args: [wbtcUSDC],
    });

    const accruedMarketState = accrueInterest(marketState, rateAtTarget, await client.timestamp());

    expect(accruedMarketState.totalSupplyShares).toBe(newMarketState[1]);
    expect(accruedMarketState.totalSupplyAssets).toBe(newMarketState[0]);
    expect(accruedMarketState.totalBorrowShares).toBe(newMarketState[3]);
    expect(accruedMarketState.totalBorrowAssets).toBe(newMarketState[2]);
  });

  helpersTest.sequential(
    "should test liquidation values for healthy position",
    async ({ client }) => {
      const marketParams = await setupBorrow(
        client,
        wbtcUSDC,
        borrower,
        parseUnits("0.1", 8),
        parseUnits("5000", 6),
      );

      const [_position, _marketState, collateralPrice] = await Promise.all([
        client.readContract({
          address: MORPHO,
          abi: morphoBlueAbi,
          functionName: "position",
          args: [wbtcUSDC, borrower.address],
        }),
        client.readContract({
          address: MORPHO,
          abi: morphoBlueAbi,
          functionName: "market",
          args: [wbtcUSDC],
        }),
        client.readContract({
          address: marketParams.oracle,
          abi: oracleAbi,
          functionName: "price",
        }),
      ]);

      const position = formatPosition(_position);
      const marketState = formatMarketState(_marketState);

      const { seizableCollateral, repayableAssets } = getLiquidationData(
        position.collateral,
        position.borrowShares,
        marketState.totalBorrowShares,
        marketState.totalBorrowAssets,
        marketParams.lltv,
        collateralPrice,
      );

      expect(seizableCollateral).toBe(0n);
      expect(repayableAssets).toBe(0n);
    },
  );

  helpersTest.sequential(
    "should test liquidation values for full collateral liquidation",
    async ({ client }) => {
      const collateralAmount = parseUnits("0.1", 8);

      const marketParams = await setupBorrow(
        client,
        wbtcUSDC,
        borrower,
        collateralAmount,
        parseUnits("5000", 6),
      );

      await overwriteCollateral(client, wbtcUSDC, borrower.address, collateralAmount / 2n);

      const [_position, _marketState, collateralPrice] = await Promise.all([
        client.readContract({
          address: MORPHO,
          abi: morphoBlueAbi,
          functionName: "position",
          args: [wbtcUSDC, borrower.address],
        }),
        client.readContract({
          address: MORPHO,
          abi: morphoBlueAbi,
          functionName: "market",
          args: [wbtcUSDC],
        }),
        client.readContract({
          address: marketParams.oracle,
          abi: oracleAbi,
          functionName: "price",
        }),
      ]);

      const position = formatPosition(_position);
      const marketState = formatMarketState(_marketState);

      const { seizableCollateral, repayableAssets } = getLiquidationData(
        position.collateral,
        position.borrowShares,
        marketState.totalBorrowShares,
        marketState.totalBorrowAssets,
        marketParams.lltv,
        collateralPrice,
      );

      expect(seizableCollateral).toBe(collateralAmount / 2n);

      await client.deal({
        erc20: marketParams.loanToken,
        account: client.account,
        amount: BigInt(repayableAssets),
      });

      await client.writeContract({
        address: marketParams.loanToken,
        abi: erc20Abi,
        functionName: "approve",
        args: [MORPHO, BigInt(repayableAssets)],
      });

      await client.writeContract({
        address: MORPHO,
        abi: morphoBlueAbi,
        functionName: "liquidate",
        args: [marketParams, borrower.address, BigInt(seizableCollateral), 0n, "0x"],
      });

      const [positionPostLiquidation, loanTokenLiquidatorBalance] = await Promise.all([
        client.readContract({
          address: MORPHO,
          abi: morphoBlueAbi,
          functionName: "position",
          args: [wbtcUSDC, borrower.address],
        }),
        client.readContract({
          address: marketParams.loanToken,
          abi: erc20Abi,
          functionName: "balanceOf",
          args: [client.account.address],
        }),
      ]);

      expect(positionPostLiquidation[0]).toBe(0n);
      expect(positionPostLiquidation[1]).toBe(0n);
      expect(positionPostLiquidation[2]).toBe(0n);

      expect(loanTokenLiquidatorBalance).toBe(0n);
    },
  );

  helpersTest.sequential(
    "should test liquidation values for full debt liquidation",
    async ({ client }) => {
      const collateralAmount = parseUnits("0.1", 8);

      const marketParams = await setupBorrow(
        client,
        wbtcUSDC,
        borrower,
        collateralAmount,
        parseUnits("5000", 6),
      );

      const newCollateralAmount = wMulDown(collateralAmount, parseUnits("0.8", 18));

      await overwriteCollateral(client, wbtcUSDC, borrower.address, newCollateralAmount);

      const [_position, _marketState, collateralPrice] = await Promise.all([
        client.readContract({
          address: MORPHO,
          abi: morphoBlueAbi,
          functionName: "position",
          args: [wbtcUSDC, borrower.address],
        }),
        client.readContract({
          address: MORPHO,
          abi: morphoBlueAbi,
          functionName: "market",
          args: [wbtcUSDC],
        }),
        client.readContract({
          address: marketParams.oracle,
          abi: oracleAbi,
          functionName: "price",
        }),
      ]);

      const position = formatPosition(_position);
      const marketState = formatMarketState(_marketState);

      const { seizableCollateral, repayableAssets } = getLiquidationData(
        position.collateral,
        position.borrowShares,
        marketState.totalBorrowShares,
        marketState.totalBorrowAssets,
        marketParams.lltv,
        collateralPrice,
      );

      expect(seizableCollateral).toBeLessThan(newCollateralAmount);

      await client.deal({
        erc20: marketParams.loanToken,
        account: client.account,
        amount: BigInt(repayableAssets),
      });

      await client.writeContract({
        address: marketParams.loanToken,
        abi: erc20Abi,
        functionName: "approve",
        args: [MORPHO, BigInt(repayableAssets)],
      });

      await client.writeContract({
        address: MORPHO,
        abi: morphoBlueAbi,
        functionName: "liquidate",
        args: [marketParams, borrower.address, BigInt(seizableCollateral), 0n, "0x"],
      });

      const [positionPostLiquidation, loanTokenLiquidatorBalance] = await Promise.all([
        client.readContract({
          address: MORPHO,
          abi: morphoBlueAbi,
          functionName: "position",
          args: [wbtcUSDC, borrower.address],
        }),
        client.readContract({
          address: marketParams.loanToken,
          abi: erc20Abi,
          functionName: "balanceOf",
          args: [client.account.address],
        }),
      ]);

      expect(positionPostLiquidation[0]).toBe(0n);
      expect(positionPostLiquidation[2]).toBe(newCollateralAmount - BigInt(seizableCollateral));

      expect(loanTokenLiquidatorBalance).toBe(0n);
    },
  );
});
