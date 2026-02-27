import nock from "nock";
import { erc20Abi, parseUnits } from "viem";
import { readContract } from "viem/actions";
import { mainnet } from "viem/chains";
import { beforeEach, describe, expect } from "vitest";

import { morphoBlueAbi } from "../../../src/abis/morpho/morphoBlue.js";
import { LiquidationBot } from "../../../src/bot.js";
import { UniswapV3Venue, Erc4626, PendlePTVenue } from "../../../src/liquidityVenues/index.js";
import { MorphoApi } from "../../../src/pricers/index.js";
import { MORPHO, wbtcUSDC, ptsUSDeUSDC, WETH, borrower } from "../../constants.js";
import { OneInchTest, setupPosition, mockEtherPrice, syncTimestamp } from "../../helpers.js";
import { encoderTest, pendleOneInchExecutionTest } from "../../setup.js";
import { MarketsFetchingCooldownMechanism } from "../../../src/utils/cooldownMechanisms.js";
import { MARKETS_FETCHING_COOLDOWN_PERIOD } from "@morpho-blue-liquidation-bot/config";

describe("execute liquidation swapping on Uniswap V3", () => {
  const erc4626 = new Erc4626();
  const uniswapV3 = new UniswapV3Venue();

  beforeEach(() => {
    nock.cleanAll();
  });

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
    mockEtherPrice(2640, marketParams);

    const bot = new LiquidationBot({
      logTag: "test client",
      chainId: mainnet.id,
      client,
      wNative: WETH,
      vaultWhitelist: [],
      additionalMarketsWhitelist: [wbtcUSDC],
      executorAddress: encoder.address,
      treasuryAddress: client.account.address,
      liquidityVenues: [erc4626, uniswapV3],
      pricers: [pricer],
      marketsFetchingCooldownMechanism: new MarketsFetchingCooldownMechanism(
        MARKETS_FETCHING_COOLDOWN_PERIOD,
      ),
      alwaysRealizeBadDebt: false,
    });

    await bot.run();

    const positionPostLiquidation = await readContract(client, {
      address: MORPHO,
      abi: morphoBlueAbi,
      functionName: "position",
      args: [wbtcUSDC, borrower.address],
    });

    const accountBalance = await readContract(client, {
      address: marketParams.loanToken,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [client.account.address],
    });

    expect(accountBalance).toBeGreaterThan(0n);
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
      mockEtherPrice(2640, marketParams);

      const bot = new LiquidationBot({
        logTag: "test client",
        chainId: mainnet.id,
        client,
        wNative: WETH,
        vaultWhitelist: [],
        additionalMarketsWhitelist: [wbtcUSDC],
        executorAddress: encoder.address,
        treasuryAddress: client.account.address,
        liquidityVenues: [erc4626, uniswapV3],
        pricers: [pricer],
        marketsFetchingCooldownMechanism: new MarketsFetchingCooldownMechanism(
          MARKETS_FETCHING_COOLDOWN_PERIOD,
        ),
        alwaysRealizeBadDebt: false,
      });

      await bot.run();

      const positionPostLiquidation = await readContract(client, {
        address: MORPHO,
        abi: morphoBlueAbi,
        functionName: "position",
        args: [wbtcUSDC, borrower.address],
      });

      const EAOBalance = await readContract(client, {
        address: marketParams.loanToken,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [client.account.address],
      });

      expect(EAOBalance).toBe(0n);
      expect(positionPostLiquidation[1]).toBeGreaterThan(0n);
      // We overiden collateral slot to make the position liquidatable
      expect(positionPostLiquidation[2]).toBe(collateralAmount / 2n);
    },
  );
});

describe("execute liquidation combining Pendle PT and 1inch liquidity venues", () => {
  process.env.PONDER_SERVICE_URL = "http://localhost:42069";

  beforeEach(() => {
    nock.cleanAll();
  });

  const pendlePT = new PendlePTVenue();
  const oneInch = new OneInchTest([1]);

  pendleOneInchExecutionTest.sequential("should execute liquidation", async ({ encoder }) => {
    const { client } = encoder;
    await syncTimestamp(client);

    const collateralAmount = parseUnits("10000", 18);
    const borrowAmount = parseUnits("9000", 6);

    const _marketParams = await readContract(encoder.client, {
      address: MORPHO,
      abi: morphoBlueAbi,
      functionName: "idToMarketParams",
      args: [ptsUSDeUSDC],
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
      logTag: "test client",
      chainId: mainnet.id,
      client,
      wNative: WETH,
      vaultWhitelist: [],
      additionalMarketsWhitelist: [ptsUSDeUSDC],
      executorAddress: encoder.address,
      treasuryAddress: client.account.address,
      liquidityVenues: [pendlePT, oneInch],
      marketsFetchingCooldownMechanism: new MarketsFetchingCooldownMechanism(
        MARKETS_FETCHING_COOLDOWN_PERIOD,
      ),
      alwaysRealizeBadDebt: false,
    });

    // mock pendle api

    nock("https://api-v2.pendle.finance/core/")
      .get("/v1/markets/all?chainId=1")
      .reply(200, {
        markets: [
          {
            name: "sUSDe",
            address: "0xb6ac3d5da138918ac4e84441e924a20daa60dbdd",
            expiry: "2025-11-27T00:00:00.000Z",
            pt: "1-0xe6a934089bbee34f832060ce98848359883749b3",
            yt: "1-0x28e626b560f1faac01544770425e2de8fd179c79",
            sy: "1-0xabf8165dd7a90ab75878161db15bf85f6f781d9b",
            underlyingAsset: "1-0x9d39a5de30e57443bff2a8307a4256c8797a3497",
            details: {
              liquidity: 122103276.29192972,
              pendleApy: 0.010007513004428379,
              impliedApy: 0.0734201534137866,
              feeRate: 0.0009650000000001047,
              movement10Percent: {
                ptMovementUpUsd: 50426744.6774943,
                ptMovementDownUsd: 15395542.757325167,
                ytMovementUpUsd: 509779.45598889096,
                ytMovementDownUsd: 145450.3039449019,
              },
              yieldRange: { min: 0.05, max: 0.25999999999999995 },
              aggregatedApy: 0.06356028215166694,
              maxBoostedApy: 0.07857155165830951,
            },
            isNew: false,
            isPrime: true,
            timestamp: "2025-07-23T03:27:11.000Z",
            lpWrapper: "1-0x5d4573aa9759870fd7ceb62a58f75a5f5559360a",
            categoryIds: ["stables", "ethena", "points"],
            chainId: 1,
          },
        ],
      })
      .get(
        "/v2/sdk/1/markets/0xb6ac3d5da138918ac4e84441e924a20daa60dbdd/swap?receiver=0x2d493cde51adc74d4494b3dc146759cf32957a23&slippage=0.04&tokenIn=0xe6a934089bbee34f832060ce98848359883749b3&tokenOut=0x9d39a5de30e57443bff2a8307a4256c8797a3497&amountIn=5000000000000000000000",
      )
      .reply(200, {
        method: "swapExactPtForToken",
        contractCallParamsName: ["receiver", "market", "exactPtIn", "output", "limit"],
        contractCallParams: [
          "0x2d493cde51adc74d4494b3dc146759cf32957a23",
          "0xb6ac3d5da138918ac4e84441e924a20daa60dbdd",
          "4975000000000000000000",
          {
            tokenOut: "0x9d39a5de30e57443bff2a8307a4256c8797a3497",
            minTokenOut: "3937278842477734619328",
            tokenRedeemSy: "0x9d39a5de30e57443bff2a8307a4256c8797a3497",
            pendleSwap: "0x0000000000000000000000000000000000000000",
            swapData: [Object],
          },
          {
            limitRouter: "0x0000000000000000000000000000000000000000",
            epsSkipMarket: "0",
            normalFills: [],
            flashFills: [],
            optData: "0x",
          },
        ],
        tx: {
          data: "0x594a88cc0000000000000000000000002d493cde51adc74d4494b3dc146759cf32957a23000000000000000000000000b6ac3d5da138918ac4e84441e924a20daa60dbdd00000000000000000000000000000000000000000000010db1fe8d52005c000000000000000000000000000000000000000000000000000000000000000000a000000000000000000000000000000000000000000000000000000000000001e00000000000000000000000009d39a5de30e57443bff2a8307a4256c8797a34970000000000000000000000000000000000000000000000d570b866a2da8d68c00000000000000000000000009d39a5de30e57443bff2a8307a4256c8797a3497000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000a0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000080000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000a000000000000000000000000000000000000000000000000000000000000000c000000000000000000000000000000000000000000000000000000000000000e0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000",
          to: "0x888888888889758F76e7103c6CbF23ABbF58F946",
          from: "0x2d493cde51adc74d4494b3dc146759cf32957a23",
        },
        tokenApprovals: [
          {
            token: "0xe6a934089bbee34f832060ce98848359883749b3",
            amount: "4975000000000000000000",
          },
        ],
        computingUnit: 0,
        data: {
          amountOut: "4101332127580973561801",
          priceImpact: "-0.00012984487790512072",
        },
      });

    // mock 1inch api

    nock("https://api.1inch.dev")
      .get("/swap/v6.0/1/swap")
      .query({
        chainId: 1,
        src: "0x9D39A5DE30e57443BfF2A8307A4256c8797A3497",
        dst: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
        amount: "4101332127580973561801",
        from: "0x2d493cde51adc74d4494b3dc146759cf32957a23",
        slippage: "1",
        origin: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
        includeTokensInfo: false,
        includeProtocols: false,
        includeGas: false,
        allowPartialFill: false,
        disableEstimate: true,
        usePermit2: false,
      })
      .reply(200, {
        dstAmount: "4911297816",
        tx: {
          from: "0x2d493cde51adc74d4494b3dc146759cf32957a23",
          to: "0x111111125421ca6dc452d289314280a0f8842a65",
          data: "0x07ed23790000000000000000000000005141b82f5ffda4c6fe1e372978f1c5427640a1900000000000000000000000009d39a5de30e57443bff2a8307a4256c8797a3497000000000000000000000000a0b86991c6218b36c1d19d4a2e9eb0ce3606eb480000000000000000000000005141b82f5ffda4c6fe1e372978f1c5427640a1900000000000000000000000002d493cde51adc74d4494b3dc146759cf32957a230000000000000000000000000000000000000000000000de556ac03ef8fdf7c90000000000000000000000000000000000000000000000000000000121cf0d850000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000012000000000000000000000000000000000000000000000000000000000000004fc0000000000000000000000000000000000000004de00032e00017e00004e00a0744c8c099d39a5de30e57443bff2a8307a4256c8797a349790cbe4bdd538d6e9b379bff5fe72c3d67a521de500000000000000000000000000000000000000000000000038eadbd71a5c69f951300c95ea31e4501b3b879cae2232087e478d44aeab9d39a5de30e57443bff2a8307a4256c8797a349700841d8a79620000000000000000000000004c9edd5852cd905f086c759e8383e09bff1e68b30000000000000000000000009d39a5de30e57443bff2a8307a4256c8797a3497553a2efc570c9e104942cec6ac1c18118e54c091000001ad7f29abcb00000032000000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000ffff9a5889f795069a41a8a3000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000010771e0fb53f80dc03f5120bbcb91440523216e2b87052a99f69c604a7b6e004c9edd5852cd905f086c759e8383e09bff1e68b300847fc9d4ad0000000000000000000000004c9edd5852cd905f086c759e8383e09bff1e68b3000000000000000000000000dac17f958d2ee523a2206206994597c13d831ec70000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000121abb2570000000000000000000000005141b82f5ffda4c6fe1e372978f1c5427640a190000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000001400000000000000000000000000000000000000000000000000000000000000160000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000005120bbcb91440523216e2b87052a99f69c604a7b6e00dac17f958d2ee523a2206206994597c13d831ec700847fc9d4ad000000000000000000000000a0b86991c6218b36c1d19d4a2e9eb0ce3606eb48000000000000000000000000dac17f958d2ee523a2206206994597c13d831ec70000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000121cf0d85000000000000000000000000111111125421ca6dc452d289314280a0f8842a6500000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000140000000000000000000000000000000000000000000000000000000000000016000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000006d5e854a",
          value: "0",
          gas: 0,
          gasPrice: "356795929",
        },
      });

    const accountLoanTokenBalanceBeforeLiquidation = await readContract(encoder.client, {
      address: marketParams.loanToken,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [client.account.address],
    });

    await syncTimestamp(client, 1760013015n);
    await bot.run();

    const accountLoanTokenBalanceAfterLiquidation = await readContract(encoder.client, {
      address: marketParams.loanToken,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [client.account.address],
    });

    expect(
      accountLoanTokenBalanceAfterLiquidation - accountLoanTokenBalanceBeforeLiquidation,
    ).toBeGreaterThan(0n);
  });
});
