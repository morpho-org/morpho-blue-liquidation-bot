import { chainConfigs } from "@morpho-blue-liquidation-bot/config";
import dotenv from "dotenv";
import { bytecode, executorAbi } from "executooor-viem";
import { type Address, createWalletClient, type Hex, http, type WalletClient } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { waitForTransactionReceipt } from "viem/actions";

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

export const deploy = async (client: WalletClient, account: Address) => {
  const hash = await client.deployContract({
    abi: executorAbi,
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    account: client.account!,
    bytecode,
    args: [account],
    chain: client.chain,
  });

  const tx = await waitForTransactionReceipt(client, { hash });

  console.log(`Executor deployed on ${client.chain?.id} at ${tx.contractAddress}`);

  return tx.contractAddress;
};

void run();
