import { createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { watchBlocks } from "viem/actions";

import { chainConfigs } from "../config";
import { LiquidationBot } from "./bot";

import { UniswapV3 } from "./liquidityVenues/uniswap";
import { Erc20Wrapper } from "./liquidityVenues/erc20Wrapper";
import { Erc4626 } from "./liquidityVenues/erc4626";

const main = () => {
  const args = process.argv.slice(2);
  const chainIdArg = args.find((arg) => arg.startsWith("--chainId="));

  /// TODO: import address from config. I think their should be only one config file for both apps
  const MORPHO_ADDRESS = "0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb";

  if (chainIdArg === undefined) {
    throw new Error("Chain ID is missing");
  }
  const chainId = Number(chainIdArg);

  if (chainConfigs[chainId] === undefined) {
    throw new Error(`Chain ${chainId} not supported`);
  }

  const client = createWalletClient({
    chain: chainConfigs[chainId].chain,
    transport: http(chainConfigs[chainId].rpcUrl),
    account: privateKeyToAccount(chainConfigs[chainId].liquidationPrivateKey),
  });

  // LIQUIDITY VENUES
  const liquidityVenues = [];
  liquidityVenues.push(new UniswapV3());
  liquidityVenues.push(new Erc20Wrapper());
  liquidityVenues.push(new Erc4626());

  const bot = new LiquidationBot(
    chainId,
    client,
    MORPHO_ADDRESS,
    chainConfigs[chainId].vaultWhitelist,
    chainConfigs[chainId].executorAddress,
    liquidityVenues,
  );

  watchBlocks(client, {
    onBlock: () => {
      void bot.run();
    },
  });
};
