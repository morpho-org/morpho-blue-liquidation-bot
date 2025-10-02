import type { AnvilTestClient } from "@morpho-org/test";
import { createViemTest } from "@morpho-org/test/vitest";
import dotenv from "dotenv";
import { ExecutorEncoder, executorAbi, bytecode } from "executooor-viem";
import { type Chain, mainnet } from "viem/chains";

dotenv.config();

export interface ExecutorEncoderTestContext<chain extends Chain = Chain> {
  encoder: ExecutorEncoder<AnvilTestClient<chain>>;
}

export const encoderTest = createViemTest(mainnet, {
  forkUrl: process.env.RPC_URL_1 ?? mainnet.rpcUrls.default.http[0],
  forkBlockNumber: 21_000_000,
  timeout: 100_000,
}).extend<ExecutorEncoderTestContext<typeof mainnet>>({
  encoder: async ({ client }, use) => {
    const receipt = await client.deployContractWait({
      abi: executorAbi,
      bytecode,
      args: [client.account.address],
    });

    await use(new ExecutorEncoder(receipt.contractAddress, client));
  },
});

export const encoderTestLaterBlock = createViemTest(mainnet, {
  forkUrl: process.env.RPC_URL_1 ?? mainnet.rpcUrls.default.http[0],
  forkBlockNumber: 22_588_625,
  timeout: 100_000,
}).extend<ExecutorEncoderTestContext<typeof mainnet>>({
  encoder: async ({ client }, use) => {
    const receipt = await client.deployContractWait({
      abi: executorAbi,
      bytecode,
      args: [client.account.address],
    });

    await use(new ExecutorEncoder(receipt.contractAddress, client));
  },
});

export const test = createViemTest(mainnet, {
  forkUrl: process.env.RPC_URL_1 ?? mainnet.rpcUrls.default.http[0],
  forkBlockNumber: 21_000_000,
});

export const pendlePTTest = createViemTest(mainnet, {
  forkUrl: process.env.MAINNET_RPC_URL,
  forkBlockNumber: 23_490_817,
}).extend<ExecutorEncoderTestContext<typeof mainnet>>({
  encoder: async ({ client }, use) => {
    const receipt = await client.deployContractWait({
      abi: executorAbi,
      bytecode,
      args: [client.account.address],
    });

    await use(new ExecutorEncoder(receipt.contractAddress, client));
  },
});
