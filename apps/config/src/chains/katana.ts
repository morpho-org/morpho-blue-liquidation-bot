import { defineChain } from "viem";

export const katana = defineChain({
  id: 747474,
  name: "Katana",
  network: "katana",
  nativeCurrency: {
    symbol: "ETH",
    name: "Ether",
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: ["https://rpc.katanarpc.com", "https://rpc.katana.network"],
    },
  },
  blockExplorers: {
    default: {
      name: "Katana Explorer",
      url: "https://explorer.katanarpc.com",
    },
  },
  contracts: {
    multicall3: {
      address: "0xcA11bde05977b3631167028862bE2a173976CA11",
      blockCreated: 0,
    },
  },
});
