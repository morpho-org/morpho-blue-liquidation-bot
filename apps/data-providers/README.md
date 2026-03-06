# Data Providers

Data providers are responsible for fetching market and position data for the Morpho Blue Liquidation Bot.

## Interface

Every data provider must implement the `DataProvider` interface (`src/dataProvider.ts`):

- **`init()`** (optional) — Async initialization (e.g. spinning up an indexer, waiting for backfill). Called once before the provider is used.
- **`fetchMarkets(client, vaults)`** — Returns the market IDs for the given vaults.
- **`fetchLiquidatablePositions(client, marketIds)`** — Returns liquidatable positions for the given market IDs.

Data providers are multi-chain: a single instance is shared across all chains. They are created in the script before bots are launched, and each bot receives its provider via dependency injection.

## Available Data Providers

- **MorphoApi** (`"morphoApi"`) — Queries the Morpho Blue API for liquidatable positions and reads vault markets on-chain.
- **HyperIndex** (`"hyperIndex"`) — Queries an Envio HyperIndex instance for on-chain data. Supports two modes:
  - **Self-hosted** (default): Automatically starts a local indexer from the `apps/hyperindex` package and waits for it to backfill before the bot begins.
  - **External**: Connects to an externally hosted HyperIndex instance. Set the `HYPERINDEX_URL` environment variable to skip local spin-up.

## Adding a New Data Provider

1. Add the data provider name to the `DataProviderName` type in `apps/config/src/types.ts`.
2. Create a new folder in `src/` with an `index.ts` implementing the `DataProvider` interface.
3. Register it in the factory switch in `src/factory.ts`.
4. Export it from `src/index.ts`.
5. Set `options.dataProvider` in the relevant chain configs in `apps/config/src/config.ts`.
