import { defineChain } from "viem";

export const hyperevm = defineChain({
  id: 999,
  name: "HyperEVM",
  network: "hyperevm",
  nativeCurrency: {
    symbol: "HYPE",
    name: "HYPE",
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: ["https://rpc.hyperliquid.xyz/evm"],
    },
  },
  blockExplorers: {
    default: {
      name: "HyperEVM Scan",
      url: "https://hyperevmscan.io/",
    },
  },
  contracts: {
    multicall3: {
      address: "0xcA11bde05977b3631167028862bE2a173976CA11",
      blockCreated: 13051,
    },
  },
});
