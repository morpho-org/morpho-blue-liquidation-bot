# Add Data Provider

Interactive workflow for scaffolding a new data provider. Follow CLAUDE.md "How to Add a New Data Provider" exactly.

## Input

Ask the user for:
1. **Provider name** (camelCase, e.g. `theGraph`) — this becomes the `DataProviderName` union member and directory name
2. **Whether the provider needs config constants** (deployment blocks, subgraph URLs, etc.)
3. **Whether the provider needs an `init()` step** (e.g. spinning up infrastructure, waiting for backfill)

## Steps

### 1. Config package (`apps/config`)

**a) Add to union type** in `apps/config/src/types.ts`:
- Add `"<name>"` to the `DataProviderName` union type (maintain alphabetical order within the union)

**b) If config constants are needed**, create `apps/config/src/dataProviders/<name>.ts`:
- Follow the pattern in `apps/config/src/dataProviders/hyperindex.ts` for per-chain config records
- Use `Record<number, ...>` keyed by chain ID
- Export from `apps/config/src/dataProviders/index.ts`

### 2. Data Providers package (`apps/data-providers`)

**a) Create provider implementation** at `apps/data-providers/src/<name>/index.ts`:

```typescript
import type { AccrualPosition } from "@morpho-org/blue-sdk";
import type { Account, Address, Chain, Client, Hex, Transport } from "viem";

import type { DataProvider } from "../dataProvider";

export class <ClassName> implements DataProvider {
  async init(): Promise<void> {
    // TODO: implement initialization (or remove if not needed)
  }

  async fetchMarkets(
    client: Client<Transport, Chain, Account>,
    vaults: Address[],
  ): Promise<Hex[]> {
    // TODO: implement market fetching
    throw new Error("Not implemented");
  }

  async fetchLiquidatablePositions(
    client: Client<Transport, Chain, Account>,
    marketIds: Hex[],
  ): Promise<AccrualPosition[]> {
    // TODO: implement position fetching
    throw new Error("Not implemented");
  }
}
```

Replace `<ClassName>` with an appropriate PascalCase class name (e.g. `TheGraphDataProvider`).

**b) Register in factory** at `apps/data-providers/src/factory.ts`:
- Add import for the new class
- Add `case "<name>":` to the switch returning `new <ClassName>()`

**c) Add re-export** in `apps/data-providers/src/index.ts`:
- Add `export * from "./<name>";`

### 3. Reminder

After scaffolding, remind the user:
- Set `options.dataProvider` to `"<name>"` in relevant chain configs in `apps/config/src/config.ts`
- Data providers are multi-chain: a single instance is shared across all chains using that provider
- The factory calls `init()` once before the provider is used — use it for any async setup
- Run `/test` to validate the scaffold compiles and tests pass
