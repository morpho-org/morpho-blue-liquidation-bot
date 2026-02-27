# Morpho Blue Liquidation Bot

Multi-chain liquidation bot for the Morpho Blue lending protocol. Monitors positions across all chains where Morpho is deployed and executes profitable liquidations via on-chain executor contracts.

## Architecture

Workspace monorepo with two packages:

- **`apps/config`** — Chain configurations, liquidity venue registrations, pricer ordering, and all tunable parameters. This is the single source of truth for what the bot does and how.
- **`apps/client`** — Bot logic, liquidity venue implementations, pricer implementations, and on-chain execution. Contains no configuration or secrets — everything is injected from config.

### Key abstractions

- **`LiquidityVenue`** (`apps/client/src/liquidityVenues/liquidityVenue.ts`) — Interface for converting collateral to loan token. Venues are tried in order defined by config. Each venue implements `supportsRoute` and `convert`.
- **`Pricer`** (`apps/client/src/pricers/pricer.ts`) — Interface for pricing assets in USD. Used for profitability checks. Pricers are tried in order defined by config.
- **Factories** (`apps/client/src/liquidityVenues/factory.ts`, `apps/client/src/pricers/factory.ts`) — Map config string identifiers to class instances. The config package exports only string names; the client package owns the implementations.
- **`LiquidationBot`** (`apps/client/src/bot.ts`) — Core orchestrator. Fetches markets, finds liquidatable positions, encodes liquidation calldata, simulates, checks profitability, and executes.
- **`LiquidationEncoder`** (`apps/client/src/utils/LiquidationEncoder.ts`) — Builds batched calldata for the on-chain executor contract.

### Flow

1. Config defines which chains, vaults, venues, and pricers to use
2. `script.ts` reads all chain configs, resolves secrets from env vars, launches one bot per chain
3. Each bot fetches whitelisted markets, finds liquidatable positions
4. For each position: try liquidity venues in order to convert collateral → loan token
5. Simulate the full liquidation, check profitability via pricers
6. Execute (optionally via Flashbots on mainnet)

## Non-Negotiables

- **Never commit secrets or private keys.** All secrets (RPC URLs, private keys, executor addresses) are resolved from environment variables in `apps/config/src/index.ts`. Never hardcode them anywhere.
- **Client code must not expect any configuration or secret.** All configurations (parameters, venue/pricer ordering, chain settings) live in the config package (`apps/config`). The client package receives everything via dependency injection. If you need a new parameter, add it to the config types and pass it through.
- **Never push directly to `main`.** Always use feature branches and PRs.
- **Always run tests after code changes.** Run the relevant test suite before considering work complete.
- **Preserve venue/pricer ordering semantics.** The order of `liquidityVenues` and `pricers` arrays in config is significant — venues are tried sequentially and the first successful conversion wins. Pricers are tried in order and the first price found is used.

## Code Standards

### TypeScript & viem

- Strict TypeScript. Use viem types (`Address`, `Hex`, `Chain`, `Transport`) throughout.
- Use `bigint` for all on-chain values. Never use `number` for token amounts, prices, or gas.
- Use `viem/actions` for chain interactions (`readContract`, `writeContract`, `simulateCalls`).
- Use `parseUnits`/`formatUnits` for decimal conversions — never manual `10 ** n`.

### BigInt precision

- Always be explicit about decimal precision when converting between units.
- Rounding direction matters: round in favor of the protocol (down for collateral, up for debt).
- `WAD = 10^18` is used as the fixed-point base. Use `wMulDown` from `utils/maths.ts`.

### Error handling

- Wrap on-chain calls in try/catch. A failing venue or pricer should not crash the bot.
- Log errors with the chain `logTag` prefix for multi-chain debugging.
- Use `throw new Error("context", { cause: err })` to preserve stack traces.

### Testing

- **Liquidity venue tests**: `pnpm test:liquidity-venues` — test each venue's `supportsRoute` and `convert`
- **Pricer tests**: `pnpm test:pricers` — test each pricer's `price` method
- **Bot tests**: `pnpm test:bot` — test bot orchestration (health, execution)
- Tests use vitest with 45s timeout (some tests hit live RPCs)
- When adding a new venue or pricer, always add corresponding tests

## How to Add a New Liquidity Venue

1. **Config** (`apps/config`):
   - Add the venue name to the `LiquidityVenueName` union type in `apps/config/src/types.ts`
   - Create `apps/config/src/liquidityVenues/<venueName>.ts` for any venue-specific config constants
   - Export it from `apps/config/src/liquidityVenues/index.ts`
   - Add the venue name to the `liquidityVenues` array in the relevant chain configs in `apps/config/src/config.ts`

2. **Client** (`apps/client`):
   - Create `apps/client/src/liquidityVenues/<venueName>/index.ts` implementing the `LiquidityVenue` interface
   - If needed, create a `types.ts` in the same directory for venue-specific types
   - Register it in the factory switch in `apps/client/src/liquidityVenues/factory.ts`

3. **Tests**:
   - Add `apps/client/test/vitest/liquidityVenues/<venueName>.test.ts`
   - Run `pnpm test:liquidity-venues` to validate

## How to Add a New Pricer

1. **Config** (`apps/config`):
   - Add the pricer name to the `PricerName` union type in `apps/config/src/types.ts`
   - Create `apps/config/src/pricers/<pricerName>.ts` for any pricer-specific config
   - Export it from `apps/config/src/pricers/index.ts`
   - Add the pricer name to the `pricers` array in the relevant chain configs

2. **Client** (`apps/client`):
   - Create `apps/client/src/pricers/<pricerName>/index.ts` implementing the `Pricer` interface
   - Register it in the factory switch in `apps/client/src/pricers/factory.ts`

3. **Tests**:
   - Add `apps/client/test/vitest/pricers/<pricerName>.test.ts`
   - Run `pnpm test:pricers` to validate

## How to Add a New Chain

1. If the chain is not in `viem/chains`, create a custom chain definition in `apps/config/src/chains/<chainName>.ts` and export from `apps/config/src/chains/index.ts`
2. Add a new entry to `chainConfigs` in `apps/config/src/config.ts` with:
   - `chain` — the viem Chain object
   - `wNative` — wrapped native token address
   - `options` — vault whitelist, liquidity venues (ordered), pricers (ordered), buffer, flashbots toggle, block interval
3. Set up environment variables: `RPC_URL_<chainId>`, `EXECUTOR_ADDRESS_<chainId>`, `LIQUIDATION_PRIVATE_KEY_<chainId>`
4. Deploy the executor contract on the new chain via `pnpm deploy:executor`

## Development Commands

- `pnpm build:config` — Build the config package (required before running tests or bot)
- `pnpm test:liquidity-venues` — Run liquidity venue tests
- `pnpm test:pricers` — Run pricer tests
- `pnpm test:bot` — Run bot tests
- `pnpm liquidate` — Run the bot (requires `.env`)
- `pnpm deploy:executor` — Deploy executor contract
- `pnpm lint` — Lint all packages
