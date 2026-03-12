import * as Sentry from "@sentry/node";
import dotenv from "dotenv";
import {
  ALWAYS_REALIZE_BAD_DEBT,
  MARKETS_FETCHING_COOLDOWN_PERIOD,
  POSITION_LIQUIDATION_COOLDOWN_ENABLED,
  POSITION_LIQUIDATION_COOLDOWN_PERIOD,
  type ChainConfig,
} from "@morpho-blue-liquidation-bot/config";
import type { DataProvider } from "@morpho-blue-liquidation-bot/data-providers";
import { createLiquidityVenue } from "@morpho-blue-liquidation-bot/liquidity-venues";
import { createPricer } from "@morpho-blue-liquidation-bot/pricers";
import { createWalletClient, Hex, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { watchBlocks } from "viem/actions";

import { LiquidationBot, type LiquidationBotInputs } from "./bot";
import { TenderlyConfig } from "./utils/types";
import {
  MarketsFetchingCooldownMechanism,
  PositionLiquidationCooldownMechanism,
} from "./utils/cooldownMechanisms";

export const launchBot = (config: ChainConfig, dataProvider: DataProvider) => {
  dotenv.config();

  const logTag = `[${config.chain.name} client]: `;
  console.log(`${logTag}Starting up`);

  // Set Sentry context for this chain
  Sentry.setContext("chain", {
    name: config.chain.name,
    chainId: config.chainId,
  });

  const client = createWalletClient({
    chain: config.chain,
    transport: http(config.rpcUrl),
    account: privateKeyToAccount(config.liquidationPrivateKey),
  });

  // LIQUIDITY VENUES
  const liquidityVenues = config.liquidityVenues.map((liquidityVenueName) =>
    createLiquidityVenue(liquidityVenueName),
  );

  // PRICERS
  const pricers = config.pricers
    ? config.pricers.map((pricerName) => createPricer(pricerName))
    : undefined;

  // FlASHBOTS

  let flashbotAccount = undefined;
  if (config.useFlashbots) {
    const flashbotsPrivateKey = process.env.FLASHBOTS_PRIVATE_KEY;

    if (flashbotsPrivateKey === undefined) {
      throw new Error(`${logTag} FLASHBOTS_PRIVATE_KEY is not set`);
    }

    flashbotAccount = privateKeyToAccount(process.env.FLASHBOTS_PRIVATE_KEY as Hex);
  }

  let tenderlyConfig: TenderlyConfig | undefined;
  if (config.useTenderly) {
    if (!process.env.TENDERLY_ACCOUNT || !process.env.TENDERLY_PROJECT) {
      throw new Error(`${logTag} TENDERLY_ACCOUNT or TENDERLY_PROJECT is not set`);
    }
    tenderlyConfig = {
      tenderlyAccount: process.env.TENDERLY_ACCOUNT as string,
      tenderlyProject: process.env.TENDERLY_PROJECT as string,
    };
  }

  let positionLiquidationCooldownMechanism = undefined;
  if (POSITION_LIQUIDATION_COOLDOWN_ENABLED) {
    positionLiquidationCooldownMechanism = new PositionLiquidationCooldownMechanism(
      POSITION_LIQUIDATION_COOLDOWN_PERIOD,
    );
  }

  const marketsFetchingCooldownMechanism = new MarketsFetchingCooldownMechanism(
    MARKETS_FETCHING_COOLDOWN_PERIOD,
  );

  const inputs: LiquidationBotInputs = {
    logTag,
    chainId: config.chainId,
    client,
    wNative: config.wNative,
    vaultWhitelist: config.vaultWhitelist,
    additionalMarketsWhitelist: config.additionalMarketsWhitelist,
    executorAddress: config.executorAddress,
    treasuryAddress: config.treasuryAddress ?? client.account.address,
    dataProvider,
    liquidityVenues,
    pricers,
    marketsFetchingCooldownMechanism,
    positionLiquidationCooldownMechanism,
    flashbotAccount,
    tenderlyConfig,
    alwaysRealizeBadDebt: ALWAYS_REALIZE_BAD_DEBT,
  };

  const bot = new LiquidationBot(inputs);

  const blockInterval = config.blockInterval ?? 1;
  let count = 0;

  watchBlocks(client, {
    onBlock: () => {
      if (count % blockInterval === 0) {
        bot.run().catch((e) => {
          console.error(`${logTag} uncaught error in bot.run():`, e);
          Sentry.captureException(e, {
            tags: {
              chain: config.chain.name,
              chainId: config.chainId.toString(),
            },
          });
        });
      }
      count++;
    },
  });
};
