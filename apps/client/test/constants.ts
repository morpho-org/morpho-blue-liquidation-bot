import type { Address, Hex } from "viem";

/// Token Addresses

export const USDC = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48" as Address;
export const wstETH = "0x7f39C581F595B53c5cb19bD0b3f8dA6c935E2Ca0" as Address;
export const WBTC = "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599" as Address;
export const steakUSDC = "0xBEEF01735c132Ada46AA9aA4c54623cAA92A64CB" as Address;

/// Markets

export const wstEthUSDC =
  "0xb323495f7e4148be5643a4ea4a8221eef163e4bccfdedc2a6f4696baacbc86cc" as Hex;
/// Protocols addresses

export const MORPHO = "0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb" as Address;

/// Morpho storage slots

export const POSITION_SLOT = 2n;
export const BORROW_SHARES_AND_COLLATERAL_OFFSET = 1n;
