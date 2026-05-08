import {
  MARKETS_FETCHING_COOLDOWN_PERIOD,
  POSITION_LIQUIDATION_COOLDOWN_ENABLED,
  POSITION_LIQUIDATION_COOLDOWN_PERIOD,
  ALWAYS_REALIZE_BAD_DEBT,
  type ChainConfig,
} from "@morpho-blue-liquidation-bot/config";
import type { DataProvider } from "@morpho-blue-liquidation-bot/data-providers";
import { createLiquidityVenue } from "@morpho-blue-liquidation-bot/liquidity-venues";
import { createPricer } from "@morpho-blue-liquidation-bot/pricers";
import { createWalletClient, fallback, Hex, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { watchBlocks } from "viem/actions";

import { LiquidationBot, type LiquidationBotInputs } from "./bot";
import {
  MarketsFetchingCooldownMechanism,
  PositionLiquidationCooldownMechanism,
} from "./utils/cooldownMechanisms";
import { createTelegramNotifier } from "./utils/telegram.js";

export const launchBot = (config: ChainConfig, dataProvider: DataProvider) => {
  const logTag = `[${config.chain.name} client]: `;
  const allRpcUrls = [config.rpcUrl, ...config.fallbackRpcUrls];
  console.log(`${logTag}Starting up with ${allRpcUrls.length} RPC(s): ${allRpcUrls.join(", ")}`);

  const transport =
    config.fallbackRpcUrls.length > 0
      ? fallback([config.rpcUrl, ...config.fallbackRpcUrls].map((url) => http(url)))
      : http(config.rpcUrl);
  const client = createWalletClient({
    chain: config.chain,
    transport,
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

  let positionLiquidationCooldownMechanism = undefined;
  if (POSITION_LIQUIDATION_COOLDOWN_ENABLED) {
    positionLiquidationCooldownMechanism = new PositionLiquidationCooldownMechanism(
      POSITION_LIQUIDATION_COOLDOWN_PERIOD,
    );
  }

  const marketsFetchingCooldownMechanism = new MarketsFetchingCooldownMechanism(
    MARKETS_FETCHING_COOLDOWN_PERIOD,
  );

  const notifier = createTelegramNotifier();

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
    notifier,
    flashbotAccount,
    alwaysRealizeBadDebt: ALWAYS_REALIZE_BAD_DEBT,
    disableSimulateCalls: config.disableSimulateCalls,
    minLiquidationValueUsd: config.minLiquidationValueUsd,
  };

  const bot = new LiquidationBot(inputs);

  const blockInterval = config.blockInterval ?? 1;
  let count = 0;

  const startWatching = () => {
    watchBlocks(client, {
      onBlock: (block) => {
        // Log every 50 blocks to show the bot is alive
        if (count % 50 === 0) {
          const blockNumber =
            typeof block === "bigint" ? block : (block as { number: bigint }).number;
          console.log(`${logTag}Scanning block ${blockNumber}...`);
        }

        if (count % blockInterval === 0) {
          bot.run().catch((e: unknown) => {
            console.error(`${logTag} uncaught error in bot.run():`, e);
          });
        }
        count++;
      },
      onError: (error) => {
        const retryDelay = config.watchBlocksRetryDelayMs ?? 5_000;
        console.error(`${logTag} watchBlocks error, restarting watcher in ${retryDelay}ms:`, error);
        setTimeout(startWatching, retryDelay);
      },
    });
  };

  startWatching();
};
