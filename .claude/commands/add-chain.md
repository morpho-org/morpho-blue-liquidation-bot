# Add Chain

Interactive workflow for adding a new chain to the liquidation bot. Follow CLAUDE.md "How to Add a New Chain" exactly.

## Input

Ask the user for:
1. **Chain name** — e.g. `scroll`, `linea`
2. **Is the chain available in `viem/chains`?** If not, collect:
   - Chain ID
   - Chain display name
   - Native currency symbol, name, and decimals
   - Default RPC URL
   - Block explorer URL (optional)
   - Multicall3 address and block created (optional)
3. **Wrapped native token address** (`wNative`)
4. **Vault whitelist** — list of vault addresses, or `"morpho-api"` for API-based discovery
5. **Which liquidity venues to enable** (ordered list from existing `LiquidityVenueName` values)
6. **Which pricers to enable** (ordered list from existing `PricerName` values, optional)
7. **Flashbots toggle** (`useFlashbots`)
8. **Block interval** (optional)
9. **Liquidation buffer bps** (optional, default 50)

## Steps

### 1. Custom chain definition (if not in viem/chains)

Create `apps/config/src/chains/<name>.ts`:

```typescript
import { defineChain } from "viem";

export const <name> = defineChain({
  id: <chainId>,
  name: "<displayName>",
  network: "<name>",
  nativeCurrency: {
    symbol: "<SYMBOL>",
    name: "<CurrencyName>",
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: ["<rpcUrl>"],
    },
  },
  blockExplorers: {
    default: {
      name: "<ExplorerName>",
      url: "<explorerUrl>",
    },
  },
  contracts: {
    multicall3: {
      address: "<multicall3Address>",
      blockCreated: <blockNumber>,
    },
  },
});
```

Add export in `apps/config/src/chains/index.ts`:
```typescript
export * from "./<name>";
```

### 2. Add chain config

Add an entry to `chainConfigs` in `apps/config/src/config.ts`:

```typescript
[<chainImport>.id]: {
  chain: <chainImport>,
  wNative: "<wNativeAddress>",
  options: {
    vaultWhitelist: <whitelist>,
    additionalMarketsWhitelist: [],
    liquidityVenues: [<ordered venue list>],
    pricers: [<ordered pricer list>],
    liquidationBufferBps: <bufferBps>,
    useFlashbots: <flashbotsToggle>,
    blockInterval: <interval>,
  },
},
```

Import the chain at the top of the file — from `viem/chains` if standard, or from `./chains` if custom.

### 3. Update venue/pricer config mappings

Check and update per-chain config files that have `Record<number, ...>` mappings. These typically include:

- `apps/config/src/liquidityVenues/erc20Wrapper.ts` — `wrappers` record
- `apps/config/src/liquidityVenues/uniswapV3.ts` — factory/router addresses (if uniswapV3 venue is enabled)
- `apps/config/src/liquidityVenues/uniswapV4.ts` — addresses (if uniswapV4 venue is enabled)
- `apps/config/src/pricers/uniswapV3.ts` — `USD_REFERENCE` record (if uniswapV3 pricer is enabled)

For each enabled venue/pricer, add the chain ID entry with the correct addresses. Ask the user for any chain-specific addresses needed.

### 4. Reminder

After scaffolding, remind the user:
- Set up environment variables:
  - `RPC_URL_<chainId>` — RPC endpoint
  - `EXECUTOR_ADDRESS_<chainId>` — deployed executor contract address
  - `LIQUIDATION_PRIVATE_KEY_<chainId>` — private key for the liquidator wallet
- Deploy the executor contract: `pnpm deploy:executor`
- Venue and pricer ordering matters — venues are tried sequentially, first success wins
- Run `pnpm build:config` to verify the config compiles
