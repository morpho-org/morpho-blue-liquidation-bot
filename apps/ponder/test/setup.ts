import { createViemTest } from "../../test/src/vitest";
import { mainnet } from "viem/chains";

export const test = createViemTest(mainnet, {
  forkUrl: process.env.PONDER_RPC_URL_1,
  forkBlockNumber: 19500000,
});
