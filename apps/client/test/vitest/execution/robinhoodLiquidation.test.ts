import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import {
  MARKETS_FETCHING_COOLDOWN_PERIOD,
  robinhoodChain,
} from "@morpho-blue-liquidation-bot/config";
import { AppMorphoApiDataProvider } from "@morpho-blue-liquidation-bot/data-providers";
import { ZeroEx } from "@morpho-blue-liquidation-bot/liquidity-venues";
import { getChainAddresses } from "@morpho-org/blue-sdk";
import nock from "nock";
import { erc20Abi, maxUint256, type Address, type Hex } from "viem";
import { readContract } from "viem/actions";
import { beforeEach, describe, expect } from "vitest";

import { morphoBlueAbi } from "../../../src/abis/morpho/morphoBlue.js";
import { LiquidationBot } from "../../../src/bot.js";
import { MarketsFetchingCooldownMechanism } from "../../../src/utils/cooldownMechanisms.js";
import { borrower } from "../../constants.js";
import { setupPosition } from "../../helpers.js";
import { robinhoodTest } from "../../setup.js";

const FIXTURE_PATH = fileURLToPath(
  new URL("../../fixtures/zeroEx/4663-919a9b6b.json", import.meta.url),
);
const fixture = JSON.parse(readFileSync(FIXTURE_PATH, "utf8")) as {
  marketId: Hex;
  request: Record<string, string>;
  response: Record<string, unknown>;
};

const ROBINHOOD_WNATIVE = "0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73" as Address;

describe("execute liquidation on Robinhood Chain (chainId 4663) via 0x", () => {
  beforeEach(() => {
    nock.cleanAll();
    // Ensure the data provider + venue constructors don't throw on missing env vars.
    // Values are irrelevant — every outbound HTTP call is intercepted by nock below.
    process.env.MORPHO_APP_API_KEY ??= "test-key";
    process.env.ZERO_EX_API_KEY ??= "test-key";
  });

  robinhoodTest.sequential(
    "liquidates a synthetic syrupUSDG/USDG position",
    async ({ encoder }) => {
      const { client } = encoder;
      const { morpho } = getChainAddresses(robinhoodChain.id);

      // Resolve the market on-chain so the test stays insulated from any parameter changes.
      const _marketParams = await readContract(client, {
        address: morpho,
        abi: morphoBlueAbi,
        functionName: "idToMarketParams",
        args: [fixture.marketId],
      });
      const marketParams = {
        loanToken: _marketParams[0],
        collateralToken: _marketParams[1],
        oracle: _marketParams[2],
        irm: _marketParams[3],
        lltv: _marketParams[4],
      };

      // 100 syrupUSDG of collateral after setupPosition's `/2` overwrite.
      const collateralAmount = 200n * 10n ** 6n;
      // Borrowed within the LLTV ceiling for 200 collateral (~183 USDG max),
      // but well above the post-overwrite ceiling for 100 collateral (~91.5 USDG)
      // so the position becomes liquidatable.
      const borrowAmount = 150n * 10n ** 6n;

      // The market only has ~1 USDG of supply on-chain at the fork block — not
      // enough for our 150 USDG borrow. Seed it from the test EOA so the borrow
      // succeeds. The supplied USDG stays in Morpho; the test EOA's final
      // balance after the run reflects only the liquidation skim.
      const supplyAmount = 300n * 10n ** 6n;
      await client.deal({
        erc20: marketParams.loanToken,
        account: client.account.address,
        amount: supplyAmount,
      });
      await client.approve({
        address: marketParams.loanToken,
        args: [morpho, maxUint256],
      });
      await client.writeContract({
        address: morpho,
        abi: morphoBlueAbi,
        functionName: "supply",
        args: [marketParams, supplyAmount, 0n, client.account.address, "0x"],
      });

      await setupPosition(client, marketParams, collateralAmount, borrowAmount, {
        morpho,
        graphqlBaseUrl: "https://app.api.morpho.org",
        chainId: robinhoodChain.id,
      });

      // Mock the 0x v2 swap response — the bot will hit the live API otherwise.
      // The cached fixture was captured for a 100 syrupUSDG -> USDG swap with
      // taker=0x5FbDB...aa3 (the deterministic test executor address).
      nock("https://api.0x.org")
        .persist()
        .get("/swap/allowance-holder/quote")
        .query(true)
        .reply(200, fixture.response);

      const bot = new LiquidationBot({
        logTag: "rh-test ",
        chainId: robinhoodChain.id,
        client,
        wNative: ROBINHOOD_WNATIVE,
        vaultWhitelist: [],
        additionalMarketsWhitelist: [fixture.marketId],
        executorAddress: encoder.address,
        treasuryAddress: client.account.address,
        dataProvider: new AppMorphoApiDataProvider(),
        liquidityVenues: [new ZeroEx()],
        marketsFetchingCooldownMechanism: new MarketsFetchingCooldownMechanism(
          MARKETS_FETCHING_COOLDOWN_PERIOD,
        ),
        // Skip the profitability check: the public blue-api doesn't index chain
        // 4663, so the MorphoApi pricer can't be used here, and partial seizes of
        // bad-debt positions inevitably lose value vs. raw borrow.
        alwaysRealizeBadDebt: true,
      });

      await bot.run();

      const positionPostLiquidation = await readContract(client, {
        address: morpho,
        abi: morphoBlueAbi,
        functionName: "position",
        args: [fixture.marketId, borrower.address],
      });

      const treasuryLoanBalance = await readContract(client, {
        address: marketParams.loanToken,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [client.account.address],
      });

      // Position fully cleared — Morpho realizes the remaining debt as bad debt
      // because all collateral was seized.
      expect(positionPostLiquidation[0]).toBe(0n);
      expect(positionPostLiquidation[1]).toBe(0n);
      expect(positionPostLiquidation[2]).toBe(0n);

      // Treasury skim got the leftover USDG from the swap (output ~99.85 USDG,
      // Morpho pulls ~97.5 USDG for repayment, leaving a couple USDG dust).
      expect(treasuryLoanBalance).toBeGreaterThan(0n);
    },
  );
});
