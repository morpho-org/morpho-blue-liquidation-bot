# Pricers

Pricers are used to price assets in USD for profitability checks in the Morpho Blue Liquidation Bot.

## Interface

Every pricer must implement the `Pricer` interface (`src/pricer.ts`):

- **`price(client, asset)`** — Returns the USD price of the asset, or `undefined` if unsupported.

The method can be sync or async.

## Available Pricers

- **DefiLlama** — Queries the DeFi Llama API.
- **MorphoApi** — Queries the Morpho Blue API.
- **Chainlink** — Queries the Chainlink feed registry contracts (mainnet only). Config: `apps/config/src/pricers/chainlink.ts` (feed registry address, denominations, token mappings).
- **UniswapV3** — Uses UniswapV3 pools to price tokens. Config: `apps/config/src/pricers/uniswapV3.ts`.

Pricers are tried in order; the first successful price wins.

## Adding a New Pricer

1. Add the pricer name to the `PricerName` type in `apps/config/src/types.ts`.
2. Create a new folder in `src/` with an `index.ts` implementing the `Pricer` interface.
3. Register it in the factory switch in `src/factory.ts`.
4. Export it from `src/index.ts`.
5. Add the pricer name to the `pricers` array in the relevant chain configs.
6. If the pricer requires chain-specific configuration, add it to `apps/config/src/pricers/`.

## Testing

Tests are in `test/vitest/`. Run with:

```bash
pnpm test:pricers
```
