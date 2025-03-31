import { createViemTest } from "../../test/src/vitest";
import { mainnet } from "viem/chains";

import dotenv from "dotenv";

dotenv.config();

export const indexingTest = createViemTest(mainnet, {
  forkUrl: process.env.PONDER_RPC_URL_1,
  forkBlockNumber: 19_200_000,
});

export const helpersTest = createViemTest(mainnet, {
  forkUrl: process.env.PONDER_RPC_URL_1,
  forkBlockNumber: 21_000_000,
});
