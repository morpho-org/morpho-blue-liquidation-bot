import type { AnvilTestClient } from "../../test/src/client";
import { ViemTestContext, createViemTest } from "../../test/src/vitest";
import { type Chain, mainnet } from "viem/chains";
import { ExecutorEncoder, executorAbi, bytecode } from "executooor-viem";

export interface ExecutorEncoderTestContext<chain extends Chain = Chain> {
  encoder: ExecutorEncoder<AnvilTestClient<chain>>;
}

export const test = createViemTest(mainnet, {
  forkUrl: process.env.MAINNET_RPC_URL,
  forkBlockNumber: 20_818_976,
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
