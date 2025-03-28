import { describe, expect } from "vitest";
import { helpersTest } from "../setup";
import { morphoBlueAbi } from "../../abis/MorphoBlue.js";
import { MORPHO, wbtcUSDC } from "../../../client/test/constants.js";
import { adaptiveCurveIrmAbi } from "../../abis/AdaptiveCurveIrm";
import { accrueInterest, borrowRate, liquidationValues } from "../../src/api/helpers";
import { testAccount } from "../../../test/src/fixtures/index.js";
import { erc20Abi, maxUint256, parseUnits } from "viem";
import { overwriteCollateral } from "../../../client/test/helpers.js";
import { oracleAbi } from "../../abis/Oracle";

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

  helpersTest.sequential.only(
    "should test liquidation values for full collateral liquidation",
    async ({ client }) => {
      const _marketParams = await client.readContract({
        address: MORPHO,
        abi: morphoBlueAbi,
        functionName: "idToMarketParams",
        args: [wbtcUSDC],
      });

      const marketParams = {
        loanToken: _marketParams[0],
        collateralToken: _marketParams[1],
        oracle: _marketParams[2],
        irm: _marketParams[3],
        lltv: _marketParams[4],
      };

      const collateralAmount = parseUnits("0.1", 8);

      await client.deal({
        erc20: marketParams.collateralToken,
        account: borrower.address,
        amount: collateralAmount,
      });

      await client.approve({
        account: borrower,
        address: marketParams.collateralToken,
        args: [MORPHO, maxUint256],
      });

      await client.writeContract({
        account: borrower,
        address: MORPHO,
        abi: morphoBlueAbi,
        functionName: "supplyCollateral",
        args: [marketParams, collateralAmount, borrower.address, "0x"],
      });

      await client.writeContract({
        account: borrower,
        address: MORPHO,
        abi: morphoBlueAbi,
        functionName: "borrow",
        args: [marketParams, parseUnits("5000", 6), 0n, borrower.address, borrower.address],
      });

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

      const position = {
        supplyShares: _position[0],
        borrowShares: _position[1],
        collateral: _position[2],
      };

      const marketState = {
        totalSupplyAssets: _marketState[0],
        totalSupplyShares: _marketState[1],
        totalBorrowAssets: _marketState[2],
        totalBorrowShares: _marketState[3],
        lastUpdate: _marketState[4],
        fee: _marketState[5],
      };

      const { seizableCollateral, repayableAssets } = liquidationValues(
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
        amount: repayableAssets,
      });

      await client.writeContract({
        address: marketParams.loanToken,
        abi: erc20Abi,
        functionName: "approve",
        args: [MORPHO, repayableAssets],
      });

      await client.writeContract({
        address: MORPHO,
        abi: morphoBlueAbi,
        functionName: "liquidate",
        args: [marketParams, borrower.address, seizableCollateral, 0n, "0x"],
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
});
