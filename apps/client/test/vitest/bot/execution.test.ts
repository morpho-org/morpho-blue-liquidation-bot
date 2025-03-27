import { maxUint256, parseUnits } from "viem";
import { describe, expect } from "vitest";
import { readContract } from "viem/actions";
import { test } from "../../setup.js";
import { UniswapV3, Erc4626 } from "../../../src/liquidityVenues/index.js";
import { morphoBlueAbi } from "../../../../ponder/abis/MorphoBlue.js";
import { MORPHO, wstEthUSDC } from "../../constants.js";
import { testAccount } from "../../../../test/src/fixtures/index.js";
import { overwriteCollateral } from "../../helpers.js";

describe("uexecute liquidation", () => {
  const erc4626 = new Erc4626();
  const uniswapV3 = new UniswapV3();

  const borrower = testAccount(1);

  test.sequential("should test convert encoding", async ({ encoder }) => {
    const { client } = encoder;
    const collateralAmount = parseUnits("1", 18);

    const _marketParams = await readContract(encoder.client, {
      address: MORPHO,
      abi: morphoBlueAbi,
      functionName: "idToMarketParams",
      args: [wstEthUSDC],
    });

    const marketParams = {
      loanToken: _marketParams[0],
      collateralToken: _marketParams[1],
      oracle: _marketParams[2],
      irm: _marketParams[3],
      lltv: _marketParams[4],
    };

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
      args: [marketParams, parseUnits("2500", 6), 0n, borrower.address, borrower.address],
    });

    await overwriteCollateral(client, wstEthUSDC, borrower.address, collateralAmount / 2n);
  });
});
