import { defineChain } from "viem";

export const monad = defineChain({
  id: 143,
  name: "Monad Mainnet",
  network: "monad",
  nativeCurrency: {
    symbol: "MON",
    name: "Monad",
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: ["https://143.rpc.hypersync.xyz"],
    },
  },
  blockExplorers: {
    default: {
      name: "Monadscan",
      url: "https://monadscan.com/",
    },
  },
  contracts: {
    multicall3: {
      address: "0xcA11bde05977b3631167028862bE2a173976CA11",
      blockCreated: 0,
    },
  },
});
