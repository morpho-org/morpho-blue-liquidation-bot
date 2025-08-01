import type { ChainConfig } from "@morpho-blue-liquidation-bot/config";
import { createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { watchBlocks } from "viem/actions";

import { LiquidationBot, type LiquidationBotInputs } from "./bot";
import { Erc20Wrapper } from "./liquidityVenues/erc20Wrapper";
import { Erc4626 } from "./liquidityVenues/erc4626";
import type { LiquidityVenue } from "./liquidityVenues/liquidityVenue";
import { UniswapV3Venue } from "./liquidityVenues/uniswapV3";
import { UniswapV4Venue } from "./liquidityVenues/uniswapV4";
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
