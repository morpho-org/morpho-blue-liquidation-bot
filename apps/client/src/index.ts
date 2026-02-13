import {
  MARKETS_FETCHING_COOLDOWN_PERIOD,
  POSITION_LIQUIDATION_COOLDOWN_ENABLED,
  POSITION_LIQUIDATION_COOLDOWN_PERIOD,
  ALWAYS_REALIZE_BAD_DEBT,
  type ChainConfig,
} from "@morpho-blue-liquidation-bot/config";
import { type Address, Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { watchBlocks } from "viem/actions";

import { LiquidationBot, type LiquidationBotInputs } from "./bot";
import { Indexer } from "./indexer/Indexer";
import { createLiquidityVenue } from "./liquidityVenues";
import { createPricer } from "./pricers";
import {
  MarketsFetchingCooldownMechanism,
  PositionLiquidationCooldownMechanism,
} from "./utils/cooldownMechanisms";
import { getClient } from "./utils/utils";

export const launchBot = async (config: ChainConfig) => {
  const logTag = `[${config.chain.name} client]: `;
  console.log(`${logTag}Starting up`);

  const client = getClient(
    config.chain,
    config.rpcUrl,
    config.liquidationPrivateKey,
    config.maxBlockRange,
  );

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

  let positionLiquidationCooldownMechanism = undefined;
  if (POSITION_LIQUIDATION_COOLDOWN_ENABLED) {
    positionLiquidationCooldownMechanism = new PositionLiquidationCooldownMechanism(
      POSITION_LIQUIDATION_COOLDOWN_PERIOD,
    );
  }

  const marketsFetchingCooldownMechanism = new MarketsFetchingCooldownMechanism(
    MARKETS_FETCHING_COOLDOWN_PERIOD,
  );

  // INDEXER
  const initialVaultAddresses: Address[] =
    config.vaultWhitelist === "morpho-api" ? [] : config.vaultWhitelist;

  const indexer = new Indexer({
    client,
    startBlock: config.startBlock ?? 0n,
    maxBlockRange: config.maxBlockRange,
    vaultAddresses: initialVaultAddresses,
    rebuild: config.rebuild,
  });

  await indexer.init();

  const inputs: LiquidationBotInputs = {
    logTag,
    chainId: config.chainId,
    client,
    wNative: config.wNative,
    vaultWhitelist: config.vaultWhitelist,
    additionalMarketsWhitelist: config.additionalMarketsWhitelist,
    executorAddress: config.executorAddress,
    treasuryAddress: config.treasuryAddress ?? client.account.address,
    liquidityVenues,
    pricers,
    marketsFetchingCooldownMechanism,
    positionLiquidationCooldownMechanism,
    flashbotAccount,
    alwaysRealizeBadDebt: ALWAYS_REALIZE_BAD_DEBT,
    indexer,
  };

  const bot = new LiquidationBot(inputs);

  const blockInterval = config.blockInterval ?? 1;
  let count = 0;

  watchBlocks(client, {
    onBlock: () => {
      if (count % blockInterval === 0) {
        try {
          void indexer.sync().then(() => bot.run());
        } catch (e) {
          console.error(`${logTag} uncaught error in bot.run():`, e);
        }
      }
      count++;
    },
  });
};
