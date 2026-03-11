# Data Providers

Data providers are responsible for fetching market and position data for the Morpho Blue Liquidation Bot.

## Interface

Every data provider must implement the `DataProvider` interface (`src/dataProvider.ts`):

- **`init()`** (optional) — Async initialization (e.g. spinning up an indexer, waiting for backfill). Called once before the provider is used.
- **`fetchMarkets(client, vaults)`** — Returns the market IDs for the given vaults.
- **`fetchLiquidatablePositions(client, marketIds)`** — Returns liquidatable positions for the given market IDs.

Data providers are multi-chain: a single instance is shared across all chains. They are created in the script before bots are launched, and each bot receives its provider via dependency injection.

## Available Data Providers

### `morphoApi`

Queries the [Morpho API](https://docs.morpho.org/api) for liquidatable positions (with pagination) and reads vault markets on-chain. No infrastructure required. Does not support pre-liquidations.

### `hyperIndex`

Queries an [Envio HyperIndex](https://docs.envio.dev/) instance (see `apps/hyperindex`) via GraphQL. Supports both liquidations and pre-liquidations. Fetches positions/markets, pre-liquidation contracts, and authorizations in parallel. Oracle prices are read on-chain. Supports two deployment modes:

#### 1. External instance (no Docker needed)

Connect to an already-running HyperIndex deployment by setting `HYPERINDEX_URL`:

```bash
HYPERINDEX_URL=https://my-indexer.example.com/v1/graphql
```

The provider connects directly — no local indexer is started.

#### 2. Self-hosted (default)

When `HYPERINDEX_URL` is **not set**, the provider starts a local indexer via `pnpm start` in `apps/hyperindex` and waits for it to backfill before the bot begins.

Requires Docker (Envio manages `envio-postgres` and `envio-hasura` containers).

The sync mode (HyperSync vs RPC) is configured in `apps/hyperindex` — see its README. In short:
- `ENVIO_API_TOKEN` set → HyperSync (fast, no RPC needed)
- `ENVIO_API_TOKEN` not set → RPC (requires `RPC_URL_<chainId>`)

### Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `HYPERINDEX_URL` | No | URL of an external HyperIndex GraphQL endpoint. If unset, self-hosts locally. |

### Configuration

Set the data provider in `apps/config/src/config.ts`:

```typescript
[mainnet.id]: {
  options: {
    dataProvider: "hyperIndex",  // or "morphoApi"
    // ...
  },
},
```

## Adding a New Data Provider

1. Add the data provider name to the `DataProviderName` type in `apps/config/src/types.ts`.
2. Create a new folder in `src/` with an `index.ts` implementing the `DataProvider` interface.
3. Register it in the factory switch in `src/factory.ts`.
4. Export it from `src/index.ts`.
5. Set `options.dataProvider` in the relevant chain configs in `apps/config/src/config.ts`.
