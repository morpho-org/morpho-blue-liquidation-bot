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

### `appMorphoApi`

Same query semantics as `morphoApi` (same GraphQL document, same pagination, same on-chain market accrual logic), but targets the app/private Morpho GraphQL endpoint instead of the public `blue-api.morpho.org`. Useful for chains that the public API doesn't yet index but the internal app instance does. Requires an API key.

| Variable | Required | Description |
|----------|----------|-------------|
| `MORPHO_APP_API_KEY` | Yes | API key sent with every GraphQL request. |
| `MORPHO_APP_API_GRAPHQL_URL` | No | GraphQL endpoint. Defaults to `https://app.api.morpho.org/graphql`. |
| `MORPHO_APP_API_KEY_HEADER` | No | HTTP header used to carry the key. Defaults to `x-api-key`. |

Caveats:
- The `vaultWhitelist: "morpho-api"` shortcut still hits `blue-api.morpho.org` — for chains not on the public API, use explicit vault addresses in `vaultWhitelist`.
- The `morphoApi` pricer also hits `blue-api.morpho.org` — for chains not on the public API, omit `morphoApi` from `pricers` and rely on on-chain pricers (`chainlink`, `uniswapV3`) instead.

### `hyperIndex`

Queries an [Envio HyperIndex](https://docs.envio.dev/) instance (see `apps/hyperindex`) via GraphQL. Supports both liquidations and pre-liquidations. Fetches positions/markets, pre-liquidation contracts, and authorizations in parallel. Oracle prices are read on-chain. Supports two deployment modes:

#### 1. Envio hosted service (recommended)

Use the [Envio hosting service](https://docs.envio.dev/docs/HyperIndex/hosted-service) to deploy and manage the indexer. Set `HYPERINDEX_URL` to point to the hosted instance:

```bash
HYPERINDEX_URL=https://indexer.bigdevenergy.link/<your-indexer-id>/v1/graphql
```

The provider connects directly — no local indexer is started. This is the recommended approach as it avoids local infrastructure, handles backfill automatically, and provides reliable uptime.

#### 2. Self-hosted with RPCs

When `HYPERINDEX_URL` is **not set**, the provider starts a local indexer via `pnpm start` in `apps/hyperindex` and waits for it to backfill before the bot begins. While self-hosting is possible, it requires more setup and maintenance — the Envio hosted service is recommended for production use.

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
    dataProvider: "hyperIndex",  // or "morphoApi", "appMorphoApi"
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
