# Data Providers

Data providers are responsible for fetching market and position data for the Morpho Blue Liquidation Bot.

## Interface

Every data provider must implement the `DataProvider` interface (`src/dataProvider.ts`):

- **`fetchMarkets(client, vaults)`** — Returns the market IDs for the given vaults.
- **`fetchLiquidatablePositions(client, marketIds)`** — Returns liquidatable positions for the given market IDs.

## Available Data Providers

- **MorphoApi** — Queries the Morpho Blue API for liquidatable positions and reads vault markets on-chain.

## Adding a New Data Provider

1. Add the data provider name to the `DataProviderName` type in `apps/config/src/types.ts`.
2. Create a new folder in `src/` with an `index.ts` implementing the `DataProvider` interface.
3. Register it in the factory switch in `src/factory.ts`.
4. Export it from `src/index.ts`.
5. Set `options.dataProvider` in the relevant chain configs in `apps/config/src/config.ts`.
