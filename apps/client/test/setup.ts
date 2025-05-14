import type { AnvilTestClient } from "@morpho-org/test";
import { createViemTest } from "@morpho-org/test/vitest";
import { type Chain, mainnet } from "viem/chains";
import { ExecutorEncoder, executorAbi, bytecode } from "executooor-viem";
import dotenv from "dotenv";

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

export const test = createViemTest(mainnet, {
  forkUrl: process.env.RPC_URL_1 ?? mainnet.rpcUrls.default.http[0],
  forkBlockNumber: 21_000_000,
});
