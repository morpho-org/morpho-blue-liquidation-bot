import type { AnvilArgs } from "@morpho-org/test";
import { type HDNodeWallet, JsonRpcProvider } from "ethers";
import type { Chain } from "viem";
import { testWallet } from "../fixtures/ethers";
import { type ViemTestContext, createViemTest } from "./index";

export interface EthersWalletTestContext {
  wallet: HDNodeWallet & { provider: JsonRpcProvider };
}

export interface EthersTestContext<chain extends Chain = Chain>
  extends ViemTestContext<chain>,
    EthersWalletTestContext {}

export const createEthersTest = <chain extends Chain>(
  chain: chain,
  parameters?: AnvilArgs,
) => {
  return createViemTest(chain, parameters).extend<EthersWalletTestContext>({
    wallet: async ({ client }, use) => {
      await use(
        testWallet(
          new JsonRpcProvider(client.transport.url, undefined, {
            staticNetwork: true,
          }),
        ),
      );
    },
  });
};
