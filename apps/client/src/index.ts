import { createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { watchBlocks } from "viem/actions";

import { LiquidationBot } from "./bot";

import { UniswapV3 } from "./liquidityVenues/uniswap";
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
  const liquidityVenues = [];
  liquidityVenues.push(new UniswapV3());
  liquidityVenues.push(new Erc20Wrapper());
  liquidityVenues.push(new Erc4626());

  const bot = new LiquidationBot(
    config.chainId,
    client,
    config.morpho.address,
    config.vaultWhitelist,
    config.executorAddress,
    liquidityVenues,
  );

  watchBlocks(client, {
    onBlock: () => {
      void bot.run();
    },
  });
};
