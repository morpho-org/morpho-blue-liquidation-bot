# HyperIndex

Envio HyperIndex indexer for the Morpho Blue protocol. Indexes on-chain events (markets, positions, authorizations, vaults) and serves them via a GraphQL API (Hasura).

Used by the `HyperIndexDataProvider` in `apps/data-providers` as a data source for the liquidation bot.

## Requirements

- **Docker** — Envio manages `envio-postgres` and `envio-hasura` containers automatically.
- **Node.js** — See `.nvmrc` at repo root.

## Sync Modes

The sync mode is determined automatically by the `ENVIO_API_TOKEN` environment variable:

| `ENVIO_API_TOKEN` | Sync mode | RPC needed? |
|-------------------|-----------|-------------|
| Set | [HyperSync](https://docs.envio.dev/docs/HyperSync/overview) (fast, hosted) | No |
| Not set | RPC | Yes (`RPC_URL_<chainId>`) |

The config generator (`pnpm generate:config`) reads this at generation time and produces the appropriate `config.yaml`.

### HyperSync (recommended for production)

Set `ENVIO_API_TOKEN` (get one at [envio.dev/app/api-tokens](https://envio.dev/app/api-tokens)):

```bash
ENVIO_API_TOKEN=your-token pnpm generate:config
```

The generated config will have no `rpc` field — Envio uses HyperSync automatically. Available for most major chains ([supported networks](https://docs.envio.dev/docs/HyperSync/hypersync-supported-networks)).

### RPC

Without `ENVIO_API_TOKEN`, the generator falls back to RPC and requires `RPC_URL_<chainId>` for each chain:

```bash
RPC_URL_1=https://... RPC_URL_8453=https://... pnpm generate:config
```

## Configuration

Both `config.yaml` and `config.test.yaml` are auto-generated. **Do not edit them manually.**

```bash
pnpm generate:config      # Generate production config
```

## Running

### Local development

```bash
pnpm dev                  # Start with hot reload (uses config.yaml)
pnpm start                # Start without hot reload
pnpm codegen              # Regenerate types after config changes
```

`pnpm dev` and `pnpm start` will automatically start Docker containers, run codegen, and begin indexing. On first run the indexer backfills from the start block — subsequent runs resume from the last checkpoint.

### As part of the bot

The `HyperIndexDataProvider` in `apps/data-providers` can either:
1. **Self-host**: Start the indexer automatically via `pnpm start` (default). The bot waits for the indexer to backfill before starting liquidation loops — the same start-then-wait-for-sync pattern used by the test suite.
2. **Connect to an external instance**: Set `HYPERINDEX_URL` to skip self-hosting.

See the `apps/data-providers` README for configuration details.

## Testing

```bash
pnpm test                 # Run the full test suite
```

Tests always use RPC sync (not HyperSync) via `RPC_URL_1`.

### What the test does

1. Generates a test config (mainnet, blocks 18,883,124 → 19,200,000, RPC sync)
2. Starts `envio dev` with Docker containers
3. Waits for indexing to complete (~10-20 min first run, seconds on re-runs)
4. Runs vitest: compares indexed data against on-chain reads at the same block
5. Cleans up containers

### Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `RPC_URL_1` | Yes | Ethereum mainnet RPC URL (used for both indexing and fork tests) |
| `ENVIO_API_TOKEN` | No | Not used by tests (tests always use RPC) |

### CI

The test runs in GitHub Actions (`pnpm test:hyperindex`). Requirements:
- Docker must be available (GitHub-hosted Ubuntu runners have it preinstalled)
- `RPC_URL_1` must be set as a repository secret
- 30-minute timeout is configured in the workflow
- The Postgres volume is cached across runs to avoid re-indexing

The test script automatically cleans up stale Docker containers and processes before starting.

## GraphQL API

Once running, the GraphQL API is available at `http://localhost:8080/v1/graphql`.

### Example queries

```graphql
# Fetch markets
query { Market(limit: 10) { marketId loanToken collateralToken lltv } }

# Fetch positions with borrows
query { Position(where: { borrowShares: { _gt: "0" } }) { user borrowShares collateral } }

# Fetch vault withdraw queues
query { Vault { address withdrawQueue } }
```

## Architecture

### Indexed entities

- **Market** — Market state (supply/borrow totals, fee, params)
- **Position** — Per-user per-market position (supply shares, borrow shares, collateral)
- **Authorization** — Morpho authorization state (authorizer → authorizee)
- **Vault** — MetaMorpho vault withdraw queues
- **PreLiquidationContract** — PreLiquidation contract configs
- **IrmState** — Adaptive curve IRM rate-at-target values

### Event handlers

| Contract | Events | Handler |
|----------|--------|---------|
| Morpho | CreateMarket, Supply, Withdraw, Borrow, Repay, Liquidate, etc. | `src/handlers/MorphoBlue.ts` |
| MetaMorphoFactory | CreateMetaMorpho | `src/handlers/MetaMorpho.ts` |
| MetaMorpho (dynamic) | SetWithdrawQueue | `src/handlers/MetaMorpho.ts` |
| AdaptiveCurveIRM | BorrowRateUpdate | `src/handlers/AdaptiveCurveIrm.ts` |
| PreLiquidationFactory | CreatePreLiquidation | `src/handlers/PreLiquidationFactory.ts` |

MetaMorpho is a **dynamic contract**: vault addresses are registered at runtime when `CreateMetaMorpho` fires from the factory, then Envio indexes `SetWithdrawQueue` events from those vaults.

### Address normalization

All addresses stored in the indexer are **EIP-55 checksummed** (via viem's `getAddress`). This ensures consistency with the rest of the bot which uses checksummed addresses throughout.
