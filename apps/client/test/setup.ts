import type { AnvilTestClient } from "../../test/src/client";
import { createViemTest } from "../../test/src/vitest";
import { type Chain, mainnet } from "viem/chains";
import { ExecutorEncoder, executorAbi, bytecode } from "executooor-viem";
import dotenv from "dotenv";

dotenv.config();

export interface ExecutorEncoderTestContext<chain extends Chain = Chain> {
  encoder: ExecutorEncoder<AnvilTestClient<chain>>;
}

export const test = createViemTest(mainnet, {
  forkUrl: process.env.MAINNET_RPC_URL,
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
