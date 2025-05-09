import { ExecutorEncoder } from "executooor-viem";
import { type Address, createWalletClient, erc20Abi, formatUnits, type Hex, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { readContract } from "viem/actions";
import dotenv from "dotenv";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { chainConfigs } from "@morpho-blue-liquidation-bot/config";

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

  const { chainId, token } = argv;

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

  const recipient = argv.recipient ?? client.account?.address;

  const encoder = new ExecutorEncoder(executorAddress as Address, client);

  const [balance, decimals, symbol] = await Promise.all([
    readContract(client, {
      address: token as Address,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [executorAddress as Address],
    }),
    readContract(client, {
      address: token as Address,
      abi: erc20Abi,
      functionName: "decimals",
    }),
    readContract(client, {
      address: token as Address,
      abi: erc20Abi,
      functionName: "symbol",
    }),
  ]);

  if (balance > 0n) {
    encoder.erc20Transfer(token as Address, recipient as Address, balance);
    await encoder.exec();

    console.log(`Transferred ${formatUnits(balance, decimals)} ${symbol} to ${recipient} ✅`);
  }
}

run();
