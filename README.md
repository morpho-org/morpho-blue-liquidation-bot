# Morpho Blue Liquidation Bot

A simple, fast, and easily deployable liquidation bot for the **Morpho Blue** protocol. This bot is entirely based on **RPC calls** and is designed to be **easy to configure**, **customizable**, and **ready to deploy** on any EVM-compatible chain.

## Visual Architecture

![Architecture](./img/liquidation-bot-architecture.png)

## Features

- Automatically detects liquidatable positions and executes the liquidations.
- Also supports Morpho Blue pre liquidations.
- Multi-chain compatible.
- Configurable liquidity venues.
- Profit evaluation thanks to configurable pricers.
- Minimal setup and dependencies (RPC-only, no extra infra required).

### ⚠️ Disclaimer

This bot is provided as-is, without any warranty. The **Morpho Association is not responsible** for any potential loss of funds resulting from the use of this bot, including (but not limited to) gas fees, failed transactions, or liquidations on malicious or misconfigured markets (although the market whitelisting mechanism is designed to protect against unsafe liquidations).

Use at your own risk.

## Requirements

- Node.js >= 20
- [pnpm](https://pnpm.io/) (this repo uses `pnpm` as package manager)
- [Docker](https://www.docker.com/) (optional, only needed if you want to run the database locally)
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

The bot can be configured to run on any EVM-compatible chain where the Morpho stack has been deployed. The chain configuration is done in the `apps/config/config.ts` file.
For each chain, here are the parameters that needs to be configured:

### Morpho Stack parameters (addresses and start blocks)

Morpho Blue:

- `morpho.address`: The address of the Morpho contract.
- `morpho.startBlock`: The block number of the Morpho contract deployment.

Adaptive Curve IRM:

- `adaptiveCurveIrm.address`: The address of the Adaptive Curve IRM contract.
- `adaptiveCurveIrm.startBlock`: The block number of the Adaptive Curve IRM contract deployment.

Meta Morpho Factories:

- `metaMorphoFactories.addresses`: The addresses of the MetaMorpho factories.
- `metaMorphoFactories.startBlock`: The block number of the oldest MetaMorpho factory deployment.

PreLiquidation Factory:

- `preLiquidationFactory.address`: The address of the PreLiquidation factory.
- `preLiquidationFactory.startBlock`: The block number of the PreLiquidation factory deployment.

You may find the addresses in [Morpho documentation](https://docs.morpho.org/get-started/resources/addresses/), and you should use the contracts deployment blocks as start block (the contracts deployment blocks can be found on the chain explorers).

### Chain Wrapped Native Asset

- `wNative`: The chain's wrapped native asset (ex: WETH's address on Ethereum mainnet).

### Options

**Markets Whitelist**: The bot will only liquidate positions from the markets that are whitelisted. There are two ways to whitelist markets:

- `options.vaultWhitelist`: List of MetaMorpho vaults addresses. All the markets listed by those vaults will be whitelisted.
- `options.additionalMarketsWhitelist`: List of markets ids. All these markets will be whitelisted (even if they are not listed by any vault).

⚠️: These whitelists can't both be empty at the same time.

**Profit Check**: If set, this parameter makes sure to only execute profitable liquidate (including gas costs). This requires to use pricers supported on the configured chains.

- `options.checkProfit`: `true` if you want to check liquidations profit. `false` otherwise.

⚠️: If set to true, each confirgured chain should support at least one of the pricers used by the bot.

**Treasury Address (optional)**: If set, the profit of the liquidation will be sent to this address at the end of the transaction. If not set, the bot's EOA will be used.

- `options.treasuryAddress`: the intended treasury address.

**Chain Wrapped Native Asset**:

**Flashbots**:

- `options.useFlashbots`: `true` if you want to use flashbots for this chain (in that case, you will have to set the `FLASHBOTS_PRIVATE_KEY`), `false` otherwise.

**Liquidation buffer**:

- `options.liquidationBufferBps`: For a given position, the bot computes the maximum seizable collateral. Then, if the collateral price slightly increases before the liquidation execution, it will fail. To avoid such scenario, we reduce the seizable collateral by a small buffer, that can be configured in base points. If not set, a default value of 10 bps will be used. When all of the position's collateral can be seized, the buffer is not applied to allow for bad debt realization.

### Secrets

**Ponder Service Secrets (optional):**

-`PONDER_SERVICE_URL`: The url of an external ponder service that will be used by the bot (This ponder service's endpoints should be the same as the ones from this repo's `ponder` package). If not set, the bot will launch a local ponder process.

-`POSTGRES_DATABASE_URL`: The url of the postgres database that will be used by the local ponder process. If not set, the bot will launch a docker container with a local postgres database.

**Flashbot Secrets (optional):**

-`FLASHBOTS_PRIVATE_KEY`: The Flashbots private key. Only needs to be set if you intend to use Flashbots on some of your chains.

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
RPC_URL_1=https://eth-mainnet.g.alchemy.com/v2/<your-alchemy-api-key>
EXECUTOR_ADDRESS_1=0x1234567890123456789012345678901234567890
LIQUIDATION_PRIVATE_KEY_1=0x1234567890123456789012345678901234567890123456789012345678901234
```

### Liquidity Venues Configuration

Liquidity venues are explained [below](#liquidity-venues).

Some liquidity venues require chain-specific configuration. This is done in the `apps/config/src/liquidityVenues/` folder.

For example, the `uniswapV3` venue has different factory addresses for some chains (although most of the time the factory is the default one). If you want to support a chain where the default address is not working, you have to set the correct factory address in the `specificFactoryAddresses` mapping in `apps/config/src/liquidityVenues/uniswapV3.ts`.

### Pricers Configuration

Pricers are explained [below](#pricers). **Pricers are optional**, and don't need to be configured if `options.checkProfit` is set to `false` for every configured chains.

Some pricers require chain-specific configuration. This is done in the `apps/config/src/pricers/` folder.

For example, the `uniswapV3` pricer has different factory addresses for some chains (although most of the time the factory is the default one). If you want to support a chain where the default address is not working, you have to set the correct factory address in the `specificFactoryAddresses` mapping in `apps/config/src/pricers/uniswapV3.ts`.

### Cooldown Mechanism Configuration

It's possible to configure a cooldown mechanism, allowing the bot to wait a configurable time before attempting to liquidate a position that it has failed to liquidate. This mechanism is useful if some liquidity venue relies on an API with a low rate-limit (ex: 1inch).

This is done by configuring `COOLDOWN_ENABLED` (set it to `true` to enable the cooldown mechanism, `false` otherwise) and `COOLDOWN_PERIOD` (cooldown period in seconds) in the `apps/config/config.ts` file.

### Bad Debt Realization

It's possible to ensure bad debt position are always fully liquidated by the bot (even if not profitable) to realize bad debt.

This is done by configuring `ALWAYS_REALIZE_BAD_DEBT` (set it to `true` to always realize bad debt, `false` otherwise) in the `apps/config/config.ts` file.

## Executor Contract Deployment

The bot uses an executor contract to execute liquidations ([executor repository](https://github.com/Rubilmax/executooor)).
These contracts are gated (they can only be called by the owner of the contract), so you need to deploy your own.

To do so, you just need to set the `rpcUrl` and `liquidationPrivateKey` in the `.env` for every chain you want to run the bot on (after configuring them in `apps/config/config.ts`), and run the following command:

```bash
pnpm deploy:executor
```

This will deploy your own executor contract on every chain you configured, and will log the addresses in the console.

You can also deploy your executor contract through [this interface](https://rubilmax.github.io/executooor/).

## Liquidity Venues

A liquidity venue is a way to exchange a token against another token. Within a liquidation, the bot will use liquidity venues in order to get the market's loan token in exchange of the collateral token.

The bot is designed to be configurable and support multiple liquidity venues.

For now, we implemented the following ones:

- ERC20Wrapper: Enables the withdrawal from ERC20Wrapper tokens.
- ERC4626: Enables the withdrawals from ERC4626 vaults.
- UniswapV3: Enables the swap of tokens on Uniswap V3.
- UniswapV4: Enables the swap of tokens on Uniswap V4.
- 1inch: Enables the swap of tokens via the 1inch swap aggregator (requires a 1inch API Key).
- Pendle: Enables the swap (and redeem) Pendle PT tokens.

Liquidity venues can be combined to create more complex strategies. For example, you can combine the `ERC4626` and `UniswapV3` venues to liquidate a position from a 4626 vault by first withdrawing from the vault and then swapping the underlying token for the desired token.

## Add your own venue

**If you don't plan on supporting a new liquidity venue, you can ignore this section.**

To add your own venue, you need to create a new folder in the `apps/client/src/liquidityVenues` folder.
This folder should contain one `index.ts` file. In this file you will implement the new liquidity venue class that needs to implements the `LiquidityVenue` interface (located in `apps/client/src/liquidityVenues/liquidityVenue.ts`).
This class will contain the logic of the venue, and needs to export two methods: `supportsRoute`(Returns true if the venue if pair of tokens `src` and `dst` is supported by the venue) and `convert`(Encodes the calls to the related contracts and pushes them to the encoder, and returns the new `src`, `dst`, and `srcAmount`). Both these methods can be async (to allow onchain calls).

- If your venue needs any abi, you may add it to a new file named after the venue in the `apps/client/src/abis` folder.

### Configuration

If your venue requires chain-specific configuration, you need to add create a new file in the `apps/config/src/liquidityVenues` folder, named like the venue (e.g. `uniswapV3.ts`).

However, some venues don't need any configuration (ex: erc4626).

## Pricers

A pricer is a way to price a token in USD. Pricers are used to compute the profit of a liquidation, including the gas costs (this is why we expect you to set the `wNative` address of each chain).

The bot is designed to be configurable and support multiple pricers.

For now, we implemented the following ones:

- DefiLlama: Queries the DeFi Llama Api.
- MorphoApi: Queries the Morpho blue API (only works on the "full-support" chains of Morpho).
- Chainlink: Queries the chainlink feed registry contracts.
- UniswapV3: Use UniswapV3 pools to price tokens.

The bot supports multiple pricers through a fallback mechanism. When attempting to price an asset:

- It iterates through the list of pricers in the order they were provided.
- If a pricer does not support the chain or cannot price the asset, the bot moves to the next pricer.
- It iterates through the list of pricers in the order they were provided.

This continues until a compatible pricer is found, or until the end of the list is reached.

### Profit Check

The bot can evaluate the profitability of a liquidation on a given chain only if `options.checkProfit` has been set to `true` (for this chain)d and at least one pricer has been provided.

In that case, for every liquidatable position detected, the bot will try to price in USD both the liquidation premium (in loan asset) and the gas expense of the transaction.

If either asset involved in the liquidation cannot be priced (i.e., not supported by any pricer), or if the gas cost exceeds the liquidation premium, the bot won't execute the liquidation transaction. Otherwise, it will.

⚠ Note: While this mechanism helps avoid unprofitable liquidations, it may also block profitable opportunities if the required assets are not supported by the configured pricers.

### Configuration

If your pricer requires chain-specific configuration, you need to add create a new file in the `apps/config/src/pricers` folder, named like the pricer (e.g. `uniswapV3.ts`).

However, some pricers don't need any configuration (ex: `MorphoApi`).

## Add your own pricer

**If you don't plan on supporting a new pricer venue, you can ignore this section.**

To add your own pricer, you need to create a new folder in the `apps/client/src/pricers` folder.
This folder should contain one `index.ts` file. In this file you will implement the new pricer class that needs to implements the `Pricer` interface (located in `apps/client/src/pricers/Pricer.ts`).
This class will contain the logic of the pricer, and needs to export one method: `price`(Returns the price of the given asset in USD, or `undefined` if the asset is not supported). This methods can be async.

- If your pricer needs any abi, you may add it to a new file named after the pricer in the `apps/client/src/abis` folder.

## Order the liquidity venues

The liquidity venues must be imported into the `apps/client/src/index.ts` file and pushed into the `liquidityVenues` array.
Be careful with the order of the array, as it will be the order in which the venues will be used by the bot.

## Order the pricers

**If you don't want to check for liquidation profit, you can ignore this section.**

The pricers must be imported into the `apps/client/src/index.ts` file and pushed into the `pricers` array.
Be careful with the order of the array, as it will be the order in which the pricers will be used by the bot.

## Run the bot

Once the bot is installed and configured, you can run it by executing the following command:

```bash
pnpm liquidate
```

This command will start the bot, which will start liquidating once the configured chains are fully indexed.

⚠⏱️ The indexing process can take some time depending on the chains numbers of blocks.

### Claim Profit

Liquidations profits are held by the Executor Contract.

Running this script allows you to manually transfer the accumulated tokens from the Executor Contract to a specified recipient address.

```bash
pnpm skim --chainId 1 --token 0x... --recipient 0x...
```

The script accepts the following arguments:

- chainId (required): The ID of the chain where the liquidation bot is operating (e.g., 1 for Ethereum Mainnet) and you want to claim the tokens.
- token (required): The address of the token held by the Executor Contract that you want to claim.
- recipient (optional): The address to which the tokens should be sent. If not specified, the default recipient will be the EOA running the bot.

## Liquidation Process

![Process](./img/liquidation-process-high-level.png)

## Config Changes

Unfortunately, Ponder doesn't allow the same schema to be used with different configs.
In this project, the config changes only if you add, remove, or modify a chain.

So, if you try to run the bot with a set of chains that's different from the one used in your initial run, indexing will fail.
There are two ways to handle this:

### Reset the postgres database

This is the easiest and most direct solution, but you will lose the indexed data for the previous chains.

If you're using Docker to run the local Postgres database, you can simply stop and remove the container and its volume:

```bash
docker compose down -v
```

### Use a new database

This way you can have different containers storing different indexing data for different sets of chains.

- If you're using Docker to run the local Postgres database, just change the port both in the postgres url given to ponder (line 93 in `apps/ponder/ponder.config.ts`, the current port being `5432`) and in `docker-compose.yml` (make sure to set the same port, and to remember the port used by each config).
- If you are using an external postgres database, you just need to change the `POSTGRES_DATABASE_URL`.
