import nock from "nock";
import { erc20Abi, parseUnits } from "viem";
import { readContract } from "viem/actions";
import { mainnet } from "viem/chains";
import { beforeEach, describe, expect } from "vitest";

import { morphoBlueAbi } from "../../../../ponder/abis/MorphoBlue.js";
import { LiquidationBot } from "../../../src/bot.js";
import { UniswapV3Venue, Erc4626 } from "../../../src/liquidityVenues/index.js";
import { MorphoApi } from "../../../src/pricers/index.js";
import { MORPHO, borrower, WETH, wbtcUSDC } from "../../constants.js";
import { setupPosition, mockEtherPrice } from "../../helpers.js";
import { encoderTest } from "../../setup.js";

describe("read-only mode", () => {
  const erc4626 = new Erc4626();
  const uniswapV3 = new UniswapV3Venue();

  process.env.PONDER_SERVICE_URL = "http://localhost:42069";

  beforeEach(() => {
    nock.cleanAll();
  });

  encoderTest.sequential(
    "should find opportunity but not execute in read-only mode",
    async ({ encoder }) => {
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
        morphoAddress: MORPHO,
        wNative: WETH,
        vaultWhitelist: [],
        additionalMarketsWhitelist: [],
        executorAddress: encoder.address,
        treasuryAddress: client.account.address,
        liquidityVenues: [erc4626, uniswapV3],
        pricers: [pricer],
        readOnly: true,
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

      // Balance should remain 0 as no liquidation happened
      expect(accountBalance).toBe(0n);
      // Position should still have debt and collateral
      expect(positionPostLiquidation[0]).toBeGreaterThan(0n); // supplyShares
      expect(positionPostLiquidation[1]).toBeGreaterThan(0n); // borrowShares
      expect(positionPostLiquidation[2]).toBeGreaterThan(0n); // collateral
    },
  );
});
