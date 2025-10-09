import type { ChainConfig } from "@morpho-blue-liquidation-bot/config";
import { createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { watchBlocks } from "viem/actions";

import { LiquidationBot, type LiquidationBotInputs } from "./bot";
import {
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
  const logTag = `[${config.chain.name} client]: `;
  console.log(`${logTag}Starting up`);

  const client = createWalletClient({
    chain: config.chain,
    transport: http(config.rpcUrl),
    account: privateKeyToAccount(config.liquidationPrivateKey),
  });

  // LIQUIDITY VENUES
  const liquidityVenues: LiquidityVenue[] = [];
  liquidityVenues.push(new PendlePTVenue());
  liquidityVenues.push(new MidasVenue());
  liquidityVenues.push(new OneInch());
  liquidityVenues.push(new Erc20Wrapper());
  liquidityVenues.push(new Erc4626());
  liquidityVenues.push(new UniswapV3Venue());
  liquidityVenues.push(new UniswapV4Venue());

  // PRICERS
  const pricers: Pricer[] = [];
  pricers.push(new DefiLlamaPricer());
  pricers.push(new ChainlinkPricer());

  if (config.checkProfit && pricers.length === 0) {
    throw new Error(`${logTag} You must configure pricers!`);
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
    liquidityVenues,
    pricers: config.checkProfit ? pricers : undefined,
  };

  const bot = new LiquidationBot(inputs);

  watchBlocks(client, {
    onBlock: () => {
      try {
        void bot.run();
      } catch (e) {
        console.error(`${logTag} uncaught error in bot.run():`, e);
      }
    },
  });
};
