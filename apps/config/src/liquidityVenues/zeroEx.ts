import { arbitrum, base, mainnet, unichain, worldchain } from "viem/chains";

export const ZERO_EX_API_BASE_URL = "https://api.0x.org";

// 0x v2 Swap API takes slippage in basis points; 100 bps = 1%.
export const zeroExSlippageBps = 100;

export const zeroExSupportedNetworks: number[] = [
  mainnet.id,
  base.id,
  unichain.id,
  arbitrum.id,
  worldchain.id,
];
