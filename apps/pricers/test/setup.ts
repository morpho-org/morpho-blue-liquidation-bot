import { createViemTest } from "@morpho-org/test/vitest";
import { config as loadEnv } from "dotenv";
import { mainnet } from "viem/chains";

loadEnv();

export const test = createViemTest(mainnet, {
  forkUrl: process.env.RPC_URL_1 ?? mainnet.rpcUrls.default.http[0],
  forkBlockNumber: 21_000_000,
});
