import { base, mainnet } from "viem/chains";
import type { ChainConfig } from "./src/utils/types";

export const chainConfigs: Record<number, ChainConfig> = {
  [mainnet.id]: {
    vaultWhitelist: [],
    rpcUrl: process.env.RPC_URL_MAINNET ?? mainnet.rpcUrls.default.http[0],
  },
  [base.id]: {
    vaultWhitelist: [],
    rpcUrl: process.env.RPC_URL_BASE ?? base.rpcUrls.default.http[0],
  },
};
