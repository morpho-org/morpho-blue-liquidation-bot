import { createViemTest } from "@morpho-org/test/vitest";
import { mainnet } from "viem/chains";

export const indexerTest = createViemTest(mainnet, {
  forkUrl: process.env.MAINNET_RPC_URL,
});
