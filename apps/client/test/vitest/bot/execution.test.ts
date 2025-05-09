import nock from "nock";
import { describe, expect } from "vitest";
import { erc20Abi, maxUint256, parseUnits } from "viem";
import { readContract } from "viem/actions";
import { mainnet } from "viem/chains";
import { testAccount } from "@morpho-org/test";

import { test } from "../../setup.js";
import { LiquidationBot } from "../../../src/bot.js";
import { UniswapV3, Erc4626 } from "../../../src/liquidityVenues/index.js";
import { morphoBlueAbi } from "../../../../ponder/abis/MorphoBlue.js";
import { MORPHO, wbtcUSDC, WETH } from "../../constants.js";
import { overwriteCollateral } from "../../helpers.js";

describe("execute liquidation", () => {
  const erc4626 = new Erc4626();
  const uniswapV3 = new UniswapV3();

  const borrower = testAccount(1);

  test.sequential("should test convert encoding", async ({ encoder }) => {
    const { client } = encoder;
    const collateralAmount = parseUnits("0.1", 8);

    const _marketParams = await readContract(encoder.client, {
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

    const position = await readContract(client, {
      address: MORPHO,
      abi: morphoBlueAbi,
      functionName: "position",
      args: [wbtcUSDC, borrower.address],
    });

    nock("http://localhost:42069")
      .post("/chain/1/liquidatable-positions", { marketIds: [] })
      .reply(200, {
        positions: [
          {
            position: {
              chainId: mainnet.id,
              marketId: wbtcUSDC,
              user: borrower.address,
              supplyShares: `${position[0]}`,
              borrowShares: `${position[1]}`,
              collateral: `${position[2]}`,
            },
            marketParams: {
              ...marketParams,
              lltv: `${marketParams.lltv}`,
            },
            seizableCollateral: `${position[2]}`,
            repayableAssets: `${position[2]}`, // random value as it's not used for now
          },
        ],
      });

    const bot = new LiquidationBot({
      chainId: mainnet.id,
      client,
      morphoAddress: MORPHO,
      wNative: WETH,
      vaultWhitelist: [],
      additionalMarketsWhitelist: [],
      executorAddress: encoder.address,
      liquidityVenues: [erc4626, uniswapV3],
    });

    await bot.run();

    const positionPostLiquidation = await readContract(client, {
      address: MORPHO,
      abi: morphoBlueAbi,
      functionName: "position",
      args: [wbtcUSDC, borrower.address],
    });

    const executorBalance = await readContract(client, {
      address: marketParams.loanToken,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [encoder.address],
    });

    expect(executorBalance).toBeGreaterThan(0n);
    expect(positionPostLiquidation[0]).toBe(0n);
    expect(positionPostLiquidation[1]).toBe(0n);
    expect(positionPostLiquidation[2]).toBe(0n);
  });
});
