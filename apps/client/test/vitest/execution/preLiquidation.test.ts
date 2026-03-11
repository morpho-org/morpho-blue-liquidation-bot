import { MARKETS_FETCHING_COOLDOWN_PERIOD } from "@morpho-blue-liquidation-bot/config";
import { UniswapV3Venue, Erc4626 } from "@morpho-blue-liquidation-bot/liquidity-venues";
import { MorphoApi } from "@morpho-blue-liquidation-bot/pricers";
import { type MarketId, PreLiquidationPosition } from "@morpho-org/blue-sdk";
import "@morpho-org/blue-sdk-viem/lib/augment";
import { fetchAccrualPosition, fetchMarket } from "@morpho-org/blue-sdk-viem";
import { erc20Abi, maxUint256, parseUnits } from "viem";
import { readContract } from "viem/actions";
import { mainnet } from "viem/chains";
import { describe, expect } from "vitest";

import { morphoBlueAbi } from "../../../src/abis/morpho/morphoBlue.js";
import { preLiquidationFactoryAbi } from "../../../src/abis/morpho/preLiquidationFactory.js";
import { LiquidationBot } from "../../../src/bot.js";
import { MarketsFetchingCooldownMechanism } from "../../../src/utils/cooldownMechanisms.js";
import { borrower, MORPHO, PRE_LIQUIDATION_FACTORY, WETH, wbtcUSDT } from "../../constants.js";
import { MockDataProvider, mockEtherPrice, syncTimestamp } from "../../helpers.js";
import { preLiquidationTest } from "../../setup.js";

const oracleAbi = [
  {
    type: "function",
    name: "price",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
] as const;

const preLiquidationParams = {
  preLltv: 832603694978000000n,
  preLCF1: 200000000000000000n,
  preLCF2: 800000000000000000n,
  preLIF1: 1010000000000000000n,
  preLIF2: 1010000000000000000n,
};

async function setupPreLiquidationPosition(client: any) {
  const marketId = wbtcUSDT as MarketId;

  const _marketParams = await readContract(client, {
    address: MORPHO,
    abi: morphoBlueAbi,
    functionName: "idToMarketParams",
    args: [wbtcUSDT],
  });

  const marketParams = {
    loanToken: _marketParams[0],
    collateralToken: _marketParams[1],
    oracle: _marketParams[2],
    irm: _marketParams[3],
    lltv: _marketParams[4],
  };

  const fullPreLiqParams = {
    ...preLiquidationParams,
    preLiquidationOracle: marketParams.oracle,
  };

  // Create pre-liquidation contract
  const { result: preLiquidation } = await client.simulateContract({
    account: borrower,
    address: PRE_LIQUIDATION_FACTORY,
    abi: preLiquidationFactoryAbi,
    functionName: "createPreLiquidation",
    args: [wbtcUSDT, fullPreLiqParams],
  });

  await client.writeContract({
    account: borrower,
    address: PRE_LIQUIDATION_FACTORY,
    abi: preLiquidationFactoryAbi,
    functionName: "createPreLiquidation",
    args: [wbtcUSDT, fullPreLiqParams],
  });

  // Set up borrower position
  const collateralAmount = parseUnits("1", 8);

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

  // Authorize the pre-liquidation contract
  await client.writeContract({
    account: borrower,
    address: MORPHO,
    abi: morphoBlueAbi,
    functionName: "setAuthorization",
    args: [preLiquidation, true],
  });

  // Borrow close to max
  const market = await fetchMarket(marketId, client);
  const borrowed = market.getMaxBorrowAssets(collateralAmount)! - 10000000n;

  await client.writeContract({
    account: borrower,
    address: MORPHO,
    abi: morphoBlueAbi,
    functionName: "borrow",
    args: [marketParams, borrowed, 0n, borrower.address, borrower.address],
  });

  // Sync timestamp to accrue interest
  const timestamp = await syncTimestamp(client);

  // Fetch on-chain oracle price and accrued position
  const oraclePrice = await readContract(client, {
    address: marketParams.oracle,
    abi: oracleAbi,
    functionName: "price",
  });

  const accrualPosition = await fetchAccrualPosition(borrower.address, marketId, client);
  const accruedPosition = accrualPosition.accrueInterest(timestamp);

  const preLiqPosition = new PreLiquidationPosition(
    {
      ...accruedPosition,
      preLiquidation,
      preLiquidationParams: fullPreLiqParams,
      preLiquidationOraclePrice: oraclePrice,
    },
    accruedPosition.market,
  );

  return { marketParams, preLiqPosition };
}

describe("execute pre-liquidation", () => {
  const erc4626 = new Erc4626();
  const uniswapV3 = new UniswapV3Venue();

  preLiquidationTest.sequential(
    "should execute pre-liquidation on WBTC/USDT market",
    async ({ encoder }) => {
      const pricer = new MorphoApi();
      const { client } = encoder;

      const { marketParams, preLiqPosition } = await setupPreLiquidationPosition(client);

      expect(preLiqPosition.seizableCollateral).toBeDefined();
      expect(preLiqPosition.seizableCollateral).toBeGreaterThan(0n);

      const mockDataProvider = new MockDataProvider();
      mockDataProvider.setPreLiquidatablePositions([preLiqPosition]);
      mockEtherPrice(2640, marketParams);

      const bot = new LiquidationBot({
        logTag: "test client",
        chainId: mainnet.id,
        client,
        wNative: WETH,
        vaultWhitelist: [],
        additionalMarketsWhitelist: [wbtcUSDT],
        executorAddress: encoder.address,
        treasuryAddress: client.account.address,
        dataProvider: mockDataProvider,
        liquidityVenues: [erc4626, uniswapV3],
        pricers: [pricer],
        marketsFetchingCooldownMechanism: new MarketsFetchingCooldownMechanism(
          MARKETS_FETCHING_COOLDOWN_PERIOD,
        ),
        alwaysRealizeBadDebt: false,
      });

      await bot.run();

      const accountBalance = await readContract(client, {
        address: marketParams.loanToken,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [client.account.address],
      });

      expect(accountBalance).toBeGreaterThan(0n);
    },
  );

  preLiquidationTest.sequential(
    "should skip pre-liquidation when no pricers configured (profitability checks disabled)",
    async ({ encoder }) => {
      const { client } = encoder;

      const { marketParams, preLiqPosition } = await setupPreLiquidationPosition(client);

      const mockDataProvider = new MockDataProvider();
      mockDataProvider.setPreLiquidatablePositions([preLiqPosition]);

      const bot = new LiquidationBot({
        logTag: "test client",
        chainId: mainnet.id,
        client,
        wNative: WETH,
        vaultWhitelist: [],
        additionalMarketsWhitelist: [wbtcUSDT],
        executorAddress: encoder.address,
        treasuryAddress: client.account.address,
        dataProvider: mockDataProvider,
        liquidityVenues: [erc4626, uniswapV3],
        // No pricers — profitability checks are skipped, liquidation should proceed
        marketsFetchingCooldownMechanism: new MarketsFetchingCooldownMechanism(
          MARKETS_FETCHING_COOLDOWN_PERIOD,
        ),
        alwaysRealizeBadDebt: false,
      });

      await bot.run();

      const accountBalance = await readContract(client, {
        address: marketParams.loanToken,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [client.account.address],
      });

      expect(accountBalance).toBeGreaterThan(0n);
    },
  );
});
