import { parseUnits } from "viem";
import { arbitrum, base, mainnet, optimism, polygon, unichain } from "viem/chains";

export const API_BASE_URL = "https://api.1inch.dev";

export const slippage = parseUnits("0.01", 18) / 10n ** 14n; // 0.01%

export const supportedNetworks: number[] = [
  mainnet.id,
  base.id,
  optimism.id,
  polygon.id,
  arbitrum.id,
  unichain.id,
];
