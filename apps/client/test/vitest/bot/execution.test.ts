import nock from "nock";
import { describe, expect } from "vitest";
import { type Address, erc20Abi, maxUint256, parseUnits } from "viem";
import { readContract } from "viem/actions";
import { mainnet } from "viem/chains";
import type { AnvilTestClient } from "@morpho-org/test";
import { replaceBigInts as replaceBigIntsBase } from "ponder";

import { encoderTest } from "../../setup.js";
import { LiquidationBot } from "../../../src/bot.js";
import { UniswapV3Venue, Erc4626 } from "../../../src/liquidityVenues/index.js";
import { MorphoApi } from "../../../src/pricers/index.js";
import { morphoBlueAbi } from "../../../../ponder/abis/MorphoBlue.js";
import { MORPHO, wbtcUSDC, WETH, borrower } from "../../constants.js";
import { overwriteCollateral } from "../../helpers.js";

describe("execute liquidation", () => {
  const erc4626 = new Erc4626();
  const uniswapV3 = new UniswapV3Venue();

  encoderTest.sequential("should execute liquidation", async ({ encoder }) => {
    const pricer = new MorphoApi();

    const { client } = encoder;
    const collateralAmount = parseUnits("0.1", 8);
    const borrowAmount = parseUnits("5000", 6);

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

    await setupPosition(client, marketParams, collateralAmount, borrowAmount);

    const bot = new LiquidationBot({
      chainId: mainnet.id,
      client,
      morphoAddress: MORPHO,
      wNative: WETH,
      vaultWhitelist: [],
      additionalMarketsWhitelist: [],
      executorAddress: encoder.address,
      liquidityVenues: [erc4626, uniswapV3],
      pricers: [pricer],
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

  encoderTest.sequential(
    "should not execute liquidation because no profit",
    async ({ encoder }) => {
      const pricer = new MorphoApi();

      const { client } = encoder;
      const collateralAmount = parseUnits("0.0001", 8);
      const borrowAmount = parseUnits("5", 6);

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

      await setupPosition(client, marketParams, collateralAmount, borrowAmount);

      const bot = new LiquidationBot({
        chainId: mainnet.id,
        client,
        morphoAddress: MORPHO,
        wNative: WETH,
        vaultWhitelist: [],
        additionalMarketsWhitelist: [],
        executorAddress: encoder.address,
        liquidityVenues: [erc4626, uniswapV3],
        pricers: [pricer],
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

      expect(executorBalance).toBe(0n);
      expect(positionPostLiquidation[1]).toBeGreaterThan(0n);
      // We overiden collateral slot to make the position liquidatable
      expect(positionPostLiquidation[2]).toBe(collateralAmount / 2n);
    },
  );
});

async function setupPosition(
  client: AnvilTestClient,
  marketParams: {
    loanToken: Address;
    collateralToken: Address;
    oracle: Address;
    irm: Address;
    lltv: bigint;
  },
  collateralAmount: bigint,
  borrowAmount: bigint,
) {
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
    args: [marketParams, borrowAmount, 0n, borrower.address, borrower.address],
  });

  await overwriteCollateral(client, wbtcUSDC, borrower.address, collateralAmount / 2n);

  const position = await readContract(client, {
    address: MORPHO,
    abi: morphoBlueAbi,
    functionName: "position",
    args: [wbtcUSDC, borrower.address],
  });

  nock.cleanAll();
  nock("http://localhost:42069")
    .post("/chain/1/liquidatable-positions", { marketIds: [] })
    .reply(
      200,
      replaceBigInts({
        warnings: [],
        results: [
          {
            market: {
              params: marketParams,
            },
            positionsLiq: [
              {
                user: borrower.address,
                seizableCollateral: `${position[2]}n`,
              },
            ],
            positionsPreLiq: [],
          },
        ],
      }),
    );
  nock("https://blue-api.morpho.org")
    .post("/graphql")
    .reply(200, {
      data: {
        chains: [{ id: 1 }],
      },
    })
    .post("/graphql")
    .reply(200, {
      data: {
        chains: [{ id: 1 }],
      },
    })
    .post("/graphql")
    .reply(200, {
      data: {
        assets: {
          items: [
            { address: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", priceUsd: 2640 },
            { address: marketParams.loanToken, priceUsd: 1 },
          ],
        },
      },
    })
    .post("/graphql")
    .reply(200, {
      data: {
        assets: {
          items: [
            { address: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", priceUsd: 2640 },
            { address: marketParams.collateralToken, priceUsd: 1 },
          ],
        },
      },
    });
}

function replaceBigInts<T>(value: T) {
  return replaceBigIntsBase(value, (x) => `${String(x)}n`);
}
