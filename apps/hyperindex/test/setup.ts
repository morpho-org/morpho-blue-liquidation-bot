import { createViemTest } from "@morpho-org/test/vitest";
import { config as loadEnv } from "dotenv";
import { mainnet } from "viem/chains";

loadEnv();

/**
 * Fork block matches the indexer's end_block so indexed state and on-chain state align.
 */
export const END_BLOCK = 19_200_000;

export const test = createViemTest(mainnet, {
  forkUrl: process.env.RPC_URL_1 ?? mainnet.rpcUrls.default.http[0],
  forkBlockNumber: END_BLOCK,
});
