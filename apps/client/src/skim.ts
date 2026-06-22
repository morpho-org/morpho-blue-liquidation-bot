import { chainConfigs } from "@morpho-blue-liquidation-bot/config";
import dotenv from "dotenv";
import { type Address, createWalletClient, type Hex, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";

import { skim } from "./utils/skim.js";

async function run() {
  dotenv.config();

  const argv = yargs(hideBin(process.argv))
    .option("chainId", {
      type: "number",
      description: "Chain ID to use",
      demandOption: true,
    })
    .option("token", {
      type: "string",
      description: "Token address",
      demandOption: true,
    })
    .option("recipient", {
      type: "string",
      description: "Recipient address",
      demandOption: false,
    })
    .parseSync();

  const token = argv.token as Address;
  const chainId = argv.chainId;

  const rpcUrl = process.env[`RPC_URL_${chainId}`];
  const privateKey = process.env[`LIQUIDATION_PRIVATE_KEY_${chainId}`];
  const executorAddress = process.env[`EXECUTOR_ADDRESS_${chainId}`];

  if (!rpcUrl) {
    throw new Error(`RPC_URL_${chainId} is not set`);
  }
  if (!privateKey) {
    throw new Error(`LIQUIDATION_PRIVATE_KEY_${chainId} is not set`);
  }
  if (!executorAddress) {
    throw new Error(`EXECUTOR_ADDRESS_${chainId} is not set`);
  }

  const chainConfig = chainConfigs[chainId];
  if (!chainConfig) {
    throw new Error(`Chain config for ${chainId} is not set`);
  }

  const client = createWalletClient({
    chain: chainConfig.chain,
    transport: http(rpcUrl),
    account: privateKeyToAccount(privateKey as Hex),
  });

  const recipient = (argv.recipient as Address) ?? client.account.address;

  await skim(client, token, executorAddress as Address, recipient);
}

void run();
