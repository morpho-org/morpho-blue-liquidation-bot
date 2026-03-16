# Add Liquidity Venue

Interactive workflow for scaffolding a new liquidity venue. Follow CLAUDE.md "How to Add a New Liquidity Venue" exactly.

## Input

Ask the user for:
1. **Venue name** (camelCase, e.g. `curveV2`) — this becomes the `LiquidityVenueName` union member and directory name
2. **Whether the venue needs config constants** (per-chain address mappings, factory addresses, etc.)

## Steps

### 1. Config package (`apps/config`)

**a) Add to union type** in `apps/config/src/types.ts`:
- Add `"<name>"` to the `LiquidityVenueName` union type (maintain alphabetical order within the union)

**b) If config constants are needed**, create `apps/config/src/liquidityVenues/<name>.ts`:
- Follow the pattern in existing config files (e.g. `erc20Wrapper.ts` for per-chain address records, `uniswapV3.ts` for factory addresses)
- Import chain objects from `viem/chains` and custom chains from `../chains`
- Use `Record<number, ...>` keyed by chain ID
- Include all chains from `apps/config/src/config.ts`
- Export from `apps/config/src/liquidityVenues/index.ts`

### 2. Liquidity Venues package (`apps/liquidity-venues`)

**a) Create venue implementation** at `apps/liquidity-venues/src/<name>/index.ts`:

```typescript
import type { ExecutorEncoder } from "executooor-viem";
import type { Address } from "viem";

import type { ToConvert } from "../types";
import type { LiquidityVenue } from "../liquidityVenue";

export class <ClassName> implements LiquidityVenue {
  async supportsRoute(encoder: ExecutorEncoder, src: Address, dst: Address): Promise<boolean> {
    // TODO: implement route support check
    throw new Error("Not implemented");
  }

  async convert(executor: ExecutorEncoder, toConvert: ToConvert): Promise<ToConvert> {
    // TODO: implement conversion logic
    throw new Error("Not implemented");
  }
}
```

Replace `<ClassName>` with an appropriate PascalCase class name (e.g. `CurveV2Venue`).

**b) Register in factory** at `apps/liquidity-venues/src/factory.ts`:
- Add import for the new class
- Add `case "<name>":` to the switch returning `new <ClassName>()`

**c) Add re-export** in `apps/liquidity-venues/src/index.ts`:
- Add `export * from "./<name>";`

### 3. Test scaffold

Create `apps/liquidity-venues/test/vitest/<name>.test.ts`:

```typescript
import { describe, expect } from "vitest";
import { encoderTest } from "../setup.js";
import { <ClassName> } from "../../src/index.js";

describe("<name> liquidity venue", () => {
  const liquidityVenue = new <ClassName>();

  encoderTest.sequential("should test supportsRoute", async ({ encoder }) => {
    // TODO: test with known supported and unsupported routes
    expect(true).toBe(true);
  });

  encoderTest.sequential("should test convert encoding", async ({ encoder }) => {
    // TODO: test that convert produces correct calldata
    expect(true).toBe(true);
  });

  encoderTest.sequential("should test convert encoding execution", async ({ encoder }) => {
    // TODO: test end-to-end conversion via encoder.exec()
    expect(true).toBe(true);
  });
});
```

### 4. Reminder

After scaffolding, remind the user:
- Add `"<name>"` to the `liquidityVenues` array in relevant chain configs in `apps/config/src/config.ts`
- Venue ordering matters: venues are tried sequentially, first successful conversion wins
- Run `/test` to validate the scaffold compiles and tests pass
