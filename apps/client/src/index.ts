import { createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { watchBlocks } from "viem/actions";

import { LiquidationBot, type LiquidationBotInputs } from "./bot";

import type { LiquidityVenue } from "./liquidityVenues/liquidityVenue";
import type { Pricer } from "./pricers/pricer";

import { UniswapV3 } from "./liquidityVenues/uniswapV3";
import { Erc20Wrapper } from "./liquidityVenues/erc20Wrapper";
import { Erc4626 } from "./liquidityVenues/erc4626";
import type { ChainConfig } from "@morpho-blue-liquidation-bot/config";

export const launchBot = (config: ChainConfig) => {
  const client = createWalletClient({
    chain: config.chain,
    transport: http(config.rpcUrl),
    account: privateKeyToAccount(config.liquidationPrivateKey),
  });

  // LIQUIDITY VENUES
  const liquidityVenues: LiquidityVenue[] = [];
  liquidityVenues.push(new Erc20Wrapper());
  liquidityVenues.push(new Erc4626());
  liquidityVenues.push(new UniswapV3());

  // PRICERS
  const pricers: Pricer[] = [];

  if (config.checkProfit && pricers.length === 0) {
    throw new Error(`No pricers configured for chain ${config.chainId}`);
  }

  const inputs: LiquidationBotInputs = {
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
      void bot.run();
    },
  });
};
