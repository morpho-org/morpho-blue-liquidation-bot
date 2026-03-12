# Morpho Blue Liquidation Bot

A simple, fast, and easily deployable liquidation bot for the **Morpho Blue** protocol. This bot is entirely based on **RPC calls** and is designed to be **easy to configure**, **customizable**, and **ready to deploy** on any EVM-compatible chain.

## Visual Architecture

![Architecture](./img/liquidation-bot-architecture.png)

## Features

- Automatically detects liquidatable positions and executes the liquidations.
- Multi-chain compatible.
- Modular architecture with pluggable [data providers](./apps/data-providers/README.md), [liquidity venues](./apps/liquidity-venues/README.md), and [pricers](./apps/pricers/README.md).
- Profit evaluation thanks to configurable pricers.
- Minimal setup and dependencies (RPC-only, no extra infra required).

### ⚠️ Disclaimer

This bot is provided as-is, without any warranty. The **Morpho Association is not responsible** for any potential loss of funds resulting from the use of this bot, including (but not limited to) gas fees, failed transactions, or liquidations on malicious or misconfigured markets (although the market whitelisting mechanism is designed to protect against unsafe liquidations).

Use at your own risk.

## Packages

| Package                                            | Description                                                              |
| -------------------------------------------------- | ------------------------------------------------------------------------ |
| [`apps/config`](./apps/config)                     | Chain configurations, module registrations, and all tunable parameters   |
| [`apps/client`](./apps/client)                     | Bot orchestration, on-chain execution, and transaction management        |
| [`apps/data-providers`](./apps/data-providers)     | Data provider implementations for fetching market and position data      |
| [`apps/hyperindex`](./apps/hyperindex)             | Envio HyperIndex indexer for self-hosted on-chain data                   |
| [`apps/liquidity-venues`](./apps/liquidity-venues) | Liquidity venue implementations for converting collateral to loan tokens |
| [`apps/pricers`](./apps/pricers)                   | Pricer implementations for USD pricing and profitability checks          |

## Requirements

- Node.js >= 20
- [pnpm](https://pnpm.io/) (this repo uses `pnpm` as package manager)
- A valid RPC URL (via Alchemy, Infura, etc)
- The private key of an EOA with enough funds to pay for gas.
- An executor contract deployed for this EOA (see [Executor Contract Deployment](#executor-contract-deployment)).

## Installation

```bash
git clone https://github.com/morpho-org/morpho-blue-liquidation-bot.git
cd morpho-blue-liquidation-bot
pnpm install
```

## Chain Configuration

The bot can be configured to run on any EVM-compatible chain where the Morpho stack has been deployed. The chain configuration is done in the `apps/config/src/config.ts` file.

For each chain, here are the parameters that need to be configured:

### Chain Wrapped Native Asset

- `wNative`: The chain's wrapped native asset (ex: WETH's address on Ethereum mainnet).

### Options

- `options.dataProvider`: The [data provider](./apps/data-providers/README.md) to use for fetching market and position data. Currently supported: `"morphoApi"`, `"hyperIndex"`.

- `options.vaultWhitelist`: List of MetaMorpho vault addresses. All the markets listed by those vaults will be whitelisted. Can also be set to `"morpho-api"` to dynamically resolve whitelisted vaults.

- `options.additionalMarketsWhitelist`: List of market IDs to whitelist (even if they are not listed by any vault).

- `options.liquidityVenues`: Array of [liquidity venue](./apps/liquidity-venues/README.md) names. The order is the order in which venues will be tried.

- `options.pricers` (optional): Array of [pricer](./apps/pricers/README.md) names. The order is the fallback order when pricing assets. Leave undefined or empty to disable profit checks.

- `options.treasuryAddress` (optional): Address to receive liquidation profits. Defaults to the bot's EOA.

- `options.useFlashbots`: Set to `true` to use Flashbots (requires `FLASHBOTS_PRIVATE_KEY` env var).

- `options.liquidationBufferBps` (optional): Buffer in basis points to reduce seizable collateral, protecting against price movements before execution. Default: 10 bps. Not applied when realizing bad debt.

- `options.useTenderly` (optional): Set to `true` if you want to generate links to a tenderly simulation for each failing liquidation (in that case, you will have to set the `TENDERLY_ACCOUNT` and `TENDERLY_PROJECT` secrets), `false` otherwise.

- `options.blockInterval` (optional): Run liquidation checks every N blocks. Default: every block.

### Secrets

Secrets are set in the `.env` file at the root of the repository, with the following keys:

- `FLASHBOTS_PRIVATE_KEY`: The Flashbots private key. Only needs to be set if you intend to use Flashbots on some of your chains.

**Tenderly Secrets (optional):**

- `TENDERLY_ACCOUNT`: Your tenderly account name. Only needs to be set if you intend to use Tenderly simulations on some of your chains.
- `TENDERLY_PROJECT`: The name of the tenderly project you want to use. Only needs to be set if you intend to use Tenderly simulations on some of your chains.

**Chain secrets:**

For each chain, the following secrets must be set:

- `RPC_URL`: The RPC URL of the chain that will be used by the bot.
- `LIQUIDATION_PRIVATE_KEY`: The private key of the EOA that will be used to execute the liquidations.
- `EXECUTOR_ADDRESS`: The address of the executor contract. The bot uses an executor contract to execute liquidations. (see [Executor Contract Deployment](#executor-contract-deployment)).

The secrets must be set in the `.env` file at the root of the repository (e.g. `.env.example`), with the following keys:

- `RPC_URL_<chainId>`
- `EXECUTOR_ADDRESS_<chainId>`
- `LIQUIDATION_PRIVATE_KEY_<chainId>`

Example for mainnet (chainId 1):

```
RPC_URL_1=https://eth-mainnet.g.alchemy.com/v2/<your-api-key>
EXECUTOR_ADDRESS_1=0x...
LIQUIDATION_PRIVATE_KEY_1=0x...
```

### Cooldown Mechanisms

- `MARKETS_FETCHING_COOLDOWN_PERIOD`: Cooldown (in seconds) between vault market re-fetches. Configured in `apps/config/src/config.ts`.
- `POSITION_LIQUIDATION_COOLDOWN_ENABLED` / `POSITION_LIQUIDATION_COOLDOWN_PERIOD`: Optional cooldown before retrying a failed liquidation. Useful when venues rely on rate-limited APIs.

### Bad Debt Realization

Set `ALWAYS_REALIZE_BAD_DEBT` to `true` in `apps/config/src/config.ts` to always fully liquidate bad debt positions, even if not profitable.

## Executor Contract Deployment

The bot uses an executor contract to execute liquidations ([executor repository](https://github.com/Rubilmax/executooor)). These contracts are gated (only callable by the owner), so you need to deploy your own.

Set `RPC_URL_<chainId>` and `LIQUIDATION_PRIVATE_KEY_<chainId>` in `.env`, then:

```bash
pnpm deploy:executor
```

You can also deploy via [this interface](https://rubilmax.github.io/executooor/).

## Run the bot

```bash
pnpm liquidate
```

### Claim Profit

Liquidation profits are held by the Executor Contract. To transfer them:

```bash
pnpm skim --chainId 1 --token 0x... --recipient 0x...
```

- `chainId` (required): Chain ID where the tokens are held.
- `token` (required): Token address to claim.
- `recipient` (optional): Recipient address. Defaults to the bot's EOA.

## Liquidation Process

![Process](./img/liquidation-process-high-level.png)
