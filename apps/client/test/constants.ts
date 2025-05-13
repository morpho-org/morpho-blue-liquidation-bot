import type { Address, Hex } from "viem";

/// Token Addresses Mainnet

export const WETH = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2" as Address;
export const USDC = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48" as Address;
export const wstETH = "0x7f39C581F595B53c5cb19bD0b3f8dA6c935E2Ca0" as Address;
export const WBTC = "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599" as Address;
export const steakUSDC = "0xBEEF01735c132Ada46AA9aA4c54623cAA92A64CB" as Address;

/// Token Addresses Base

export const USDC_BASE = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as Address;

/// Markets

export const wbtcUSDC = "0x3a85e619751152991742810df6ec69ce473daef99e28a64ab2340d7b7ccfee49" as Hex;

/// Protocols addresses

export const MORPHO = "0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb" as Address;

/// Morpho storage slots

export const POSITION_SLOT = 2n;
export const BORROW_SHARES_AND_COLLATERAL_OFFSET = 1n;
