import type { ChainConfig } from "@morpho-blue-liquidation-bot/config";
import * as Sentry from "@sentry/node";
import dotenv from "dotenv";
import { createWalletClient, Hex, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { watchBlocks } from "viem/actions";

import { LiquidationBot, type LiquidationBotInputs } from "./bot";
import {
  LiquidSwapVenue,
  MidasVenue,
  OneInch,
  PendlePTVenue,
  Erc20Wrapper,
  Erc4626,
  UniswapV3Venue,
  UniswapV4Venue,
} from "./liquidityVenues";
import type { LiquidityVenue } from "./liquidityVenues/liquidityVenue";
import { ChainlinkPricer, DefiLlamaPricer } from "./pricers";
import type { Pricer } from "./pricers/pricer";

export const launchBot = (config: ChainConfig) => {
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
  const liquidityVenues: LiquidityVenue[] = [];
  liquidityVenues.push(new PendlePTVenue());
  liquidityVenues.push(new MidasVenue());
  liquidityVenues.push(new OneInch(process.env.ONE_INCH_SWAP_API_KEY));
  liquidityVenues.push(new Erc20Wrapper());
  liquidityVenues.push(new Erc4626());
  liquidityVenues.push(new LiquidSwapVenue());
  liquidityVenues.push(new UniswapV3Venue());
  liquidityVenues.push(new UniswapV4Venue());

  // PRICERS
  const pricers: Pricer[] = [];
  pricers.push(new DefiLlamaPricer());
  pricers.push(new ChainlinkPricer());

  if (config.checkProfit && pricers.length === 0) {
    throw new Error(`${logTag} You must configure pricers!`);
  }

  let flashbotAccount = undefined;
  if (config.useFlashbots) {
    const flashbotsPrivateKey = process.env.FLASHBOTS_PRIVATE_KEY;

    if (flashbotsPrivateKey === undefined) {
      throw new Error(`${logTag} FLASHBOTS_PRIVATE_KEY is not set`);
    }

    flashbotAccount = privateKeyToAccount(process.env.FLASHBOTS_PRIVATE_KEY as Hex);
  }

  const inputs: LiquidationBotInputs = {
    logTag,
    chainId: config.chainId,
    client,
    morphoAddress: config.morpho.address,
    wNative: config.wNative,
    vaultWhitelist: config.vaultWhitelist,
    additionalMarketsWhitelist: config.additionalMarketsWhitelist,
    executorAddress: config.executorAddress,
    treasuryAddress: config.treasuryAddress ?? client.account.address,
    liquidityVenues,
    pricers: config.checkProfit ? pricers : undefined,
    flashbotAccount,
  };

  const bot = new LiquidationBot(inputs);

  const blockInterval = config.blockInterval ?? 1;
  let count = 0;

  watchBlocks(client, {
    onBlock: () => {
      if (count % blockInterval === 0) {
        try {
          void bot.run();
        } catch (e) {
          console.error(`${logTag} uncaught error in bot.run():`, e);
          Sentry.captureException(e, {
            tags: {
              chain: config.chain.name,
              chainId: config.chainId.toString(),
            },
          });
        }
      }
      count++;
    },
  });
};
