import { arbitrum, base, mainnet, unichain, worldchain } from "viem/chains";

export const LIFI_API_BASE_URL = "https://li.quest/v1";

// Li.Fi v1 /quote takes slippage as a decimal fraction; 0.01 = 1%.
export const lifiSlippage = 0.01;

export const lifiSupportedNetworks: number[] = [
  mainnet.id,
  base.id,
  unichain.id,
  arbitrum.id,
  worldchain.id,
];
