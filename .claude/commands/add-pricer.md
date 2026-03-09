# Add Pricer

Interactive workflow for scaffolding a new pricer. Follow CLAUDE.md "How to Add a New Pricer" exactly.

## Input

Ask the user for:
1. **Pricer name** (camelCase, e.g. `pyth`) — this becomes the `PricerName` union member and directory name
2. **Whether the pricer needs config constants** (per-chain contract addresses, API keys, etc.)

## Steps

### 1. Config package (`apps/config`)

**a) Add to union type** in `apps/config/src/types.ts`:
- Add `"<name>"` to the `PricerName` union type (maintain alphabetical order within the union)

**b) If config constants are needed**, create `apps/config/src/pricers/<name>.ts`:
- Follow the pattern in `apps/config/src/pricers/uniswapV3.ts` for per-chain address records
- Import chain objects from `viem/chains` and custom chains from `../chains`
- Use `Record<number, ...>` keyed by chain ID
- Include all chains from `apps/config/src/config.ts`
- Export from `apps/config/src/pricers/index.ts`

### 2. Pricers package (`apps/pricers`)

**a) Create pricer implementation** at `apps/pricers/src/<name>/index.ts`:

```typescript
import type { Account, Address, Chain, Client, Transport } from "viem";

import type { Pricer } from "../pricer";

export class <ClassName> implements Pricer {
  async price(
    client: Client<Transport, Chain, Account>,
    asset: Address,
  ): Promise<number | undefined> {
    // TODO: implement price fetching logic
    throw new Error("Not implemented");
  }
}
```

Replace `<ClassName>` with an appropriate PascalCase class name (e.g. `PythPricer`).

**b) Register in factory** at `apps/pricers/src/factory.ts`:
- Add import for the new class
- Add `case "<name>":` to the switch returning `new <ClassName>()`

**c) Add re-export** in `apps/pricers/src/index.ts`:
- Add `export * from "./<name>";`

### 3. Test scaffold

Create `apps/pricers/test/vitest/<name>.test.ts`:

```typescript
import { describe, expect } from "vitest";

import { <ClassName> } from "../../src";
import { test } from "../setup.js";

describe("<name> pricer", () => {
  test("should return a price", async ({ client }) => {
    const pricer = new <ClassName>();
    // TODO: test with known assets
    // Example: expect(await pricer.price(client, USDC)).toBeCloseTo(1, 3);
    expect(true).toBe(true);
  });
});
```

### 4. Reminder

After scaffolding, remind the user:
- Add `"<name>"` to the `pricers` array in relevant chain configs in `apps/config/src/config.ts`
- Pricer ordering matters: pricers are tried in order, the first price found is used
- Run `/test` to validate the scaffold compiles and tests pass
