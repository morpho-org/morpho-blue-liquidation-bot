import { chainConfigs } from "@morpho-blue-liquidation-bot/config";
import dotenv from "dotenv";
import { createWalletClient, type Hex, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";

import { deploy } from "./utils/deploy-executor.js";

async function run() {
  dotenv.config();

  const configs = Object.values(chainConfigs);

  for (const config of configs) {
    const chain = config.chain;
    const id = chain.id;

    const rpcUrl = process.env[`RPC_URL_${id}`] ?? chain.rpcUrls.default.http[0];
    const privateKey = process.env[`LIQUIDATION_PRIVATE_KEY_${id}`];

    if (!rpcUrl) {
      throw new Error(`RPC_URL_${id} is not set`);
    }
    if (!privateKey) {
      throw new Error(`LIQUIDATION_PRIVATE_KEY_${id} is not set`);
    }

    const client = createWalletClient({
      chain,
      transport: http(rpcUrl),
      account: privateKeyToAccount(privateKey as Hex),
    });

    await deploy(client, privateKeyToAccount(privateKey as Hex).address);
  }
}

void run();
