# Liquidity Venues

Liquidity venues are used to convert collateral tokens to loan tokens during liquidations in the Morpho Blue Liquidation Bot.

## Interface

Every liquidity venue must implement the `LiquidityVenue` interface (`src/liquidityVenue.ts`):

- **`supportsRoute(encoder, src, dst)`** — Returns true if the venue can handle the src-to-dst conversion.
- **`convert(encoder, toConvert)`** — Encodes the conversion calls into the encoder and returns the updated `ToConvert`.

Both methods can be sync or async.

## Available Venues

- **ERC20Wrapper** — Withdraws from ERC20Wrapper tokens.
- **ERC4626** — Withdraws from ERC4626 vaults.
- **UniswapV3** — Swaps tokens on Uniswap V3. Config: `apps/config/src/liquidityVenues/uniswapV3.ts` (pool fees).
- **UniswapV4** — Swaps tokens on Uniswap V4. Config: `apps/config/src/liquidityVenues/uniswapV4.ts`.
- **1inch** — Swaps tokens via the 1inch swap aggregator (requires a 1inch API Key). Config: `apps/config/src/liquidityVenues/1inch.ts` (API URL, slippage, supported networks).
- **Pendle** — Swaps and redeems Pendle PT tokens. Config: `apps/config/src/liquidityVenues/pendlePT.ts` (API URL, slippage, refresh interval).
- **Midas** — Redeems Midas tokens. Config: `apps/config/src/liquidityVenues/midas.ts`.
- **LiquidSwap** — Swaps tokens on LiquidSwap (HyperEVM). Config: `apps/config/src/liquidityVenues/liquidSwap.ts`.

Venues can be combined (e.g., ERC4626 withdrawal followed by UniswapV3 swap).

## Adding a New Venue

1. Add the venue name to the `LiquidityVenueName` type in `apps/config/src/types.ts`.
2. Create a new folder in `src/` with an `index.ts` implementing the `LiquidityVenue` interface.
3. Register it in the factory switch in `src/factory.ts`.
4. Export it from `src/index.ts`.
5. Add the venue name to the `liquidityVenues` array in the relevant chain configs.
6. If the venue requires chain-specific configuration, add it to `apps/config/src/liquidityVenues/`.

## Testing

Tests are in `test/vitest/`. Run with:

```bash
pnpm test:liquidity-venues
```
