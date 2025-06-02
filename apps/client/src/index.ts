import type { ChainConfig } from "@morpho-blue-liquidation-bot/config";
import { createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { watchBlocks } from "viem/actions";

import { LiquidationBot } from "./bot";
import { Erc20Wrapper } from "./liquidityVenues/erc20Wrapper";
import { Erc4626 } from "./liquidityVenues/erc4626";
import { UniswapV3 } from "./liquidityVenues/uniswapV3";
import { UniswapV4Venue } from "./liquidityVenues/uniswapV4";

export const launchBot = (config: ChainConfig) => {
  const client = createWalletClient({
    chain: config.chain,
    transport: http(config.rpcUrl),
    account: privateKeyToAccount(config.liquidationPrivateKey),
  });

  // LIQUIDITY VENUES
  const liquidityVenues = [];
  liquidityVenues.push(new Erc20Wrapper());
  liquidityVenues.push(new Erc4626());
  liquidityVenues.push(new UniswapV4Venue());
  liquidityVenues.push(new UniswapV3());

  const bot = new LiquidationBot(
    config.chainId,
    client,
    config.morpho.address,
    config.vaultWhitelist,
    config.additionalMarketsWhitelist,
    config.executorAddress,
    liquidityVenues,
  );

  watchBlocks(client, {
    onBlock: () => {
      void bot.run();
    },
  });
};
