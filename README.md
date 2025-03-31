# Morpho Blue Liquidation Bot

A simple, fast, and easily deployable liquidation bot for the **Morpho Blue** protocol. This bot is entirely based on **RPC calls** and is designed to be **easy to configure**, **customizable**, and **ready to deploy** on any EVM-compatible chain.

## Features

- RPC-only (no extra infra required)
- Has its own built-in indexer
- Automatically detects liquidatable positions
- Configurable liquidity venues
- Multi-chain compatible
- Minimal setup and dependencies

## Requirements

- Node.js >= 18
- [pnpm](https://pnpm.io/) (this repo uses `pnpm` as package manager)
- Valid RPC URL (via Alchemy, Infura, etc.)
- A private key with enough funds to pay for gas

## Installation

```bash
git clone https://github.com/morpho-blue-liquidation-bot-org/morpho-blue-liquidation-bot.git
cd morpho-blue-liquidation-bot
pnpm install
```

## Chain Configuration

The bot can be configured to run on any EVM-compatible chain. The chain configuration is done in the `apps/config/config.ts` file.
For each chain, Here are the parameters that needs to be configured:

### Indexer parameters (addresses and start blocks)

Morpho Blue:

- `morpho.address`: The address of the Morpho contract.
- `morpho.startBlock`: The block number of the Morpho contract deployment.

Adaptive Curve IRM:

- `adaptiveCurveIrm.address`: The address of the Adaptive Curve IRM contract.
- `adaptiveCurveIrm.startBlock`: The block number of the Adaptive Curve IRM contract deployment.

Meta Morpho Factories:

- `metaMorphoFactories.addresses`: The addresses of the MetaMorpho factories.
- `metaMorphoFactories.startBlock`: The block number of the most oldest MetaMorpho factory deployment.

### Markets Whitelist

The bot will only liquidate positions from the markets that are whitelisted. There are two ways of whitelisting markets:

- `vaultWhitelist`: List of vaults addresses. All the markets listed by those vaults will be whitelisted.
- `additionalMarketsWhitelist`: List of markets ids. All these markets will be whitelisted (even if they are not listed by any vault).

### Secrets

- `rpcUrl`: The RPC URL of the chain that will be used by the bot.
- `ponderRpcUrl`: The RPC URL that will be used by the Ponder indexer. This field is optional, if not set, the bot will use the `rpcUrl` for the indexer.
- `executorAddress`: The address of the executor contract. The bot uses an executor contract to execute liquidations. ([Link to the executor repository](https://github.com/Rubilmax/executooor)).
- `liquidationPrivateKey`: The private key of the EOA that will be used to execute the liquidations.

The secrets must be set in the `.env` file at the root of the repository (e.g. `.env.example`), and the corresponding keys must be set in the `apps/config/config.ts` file.

## Liquidity Venues

A liquidity venue is a way to exchange a token against another token.

The bot is designed to be configurable and support multiple liquidity venues.

For now, we implemented the following ones:

- ERC20Wrapper: Enables the withdrawal from ERC20Wrapper tokens.
- ERC4626: Enables the withdrawals from ERC4626 vaults.
- UniswapV3: Enables the swap of tokens on Uniswap V3.

Within a liquidation, the bot will use liquidity venues in order to get the market's loan token in exchange of the collateral token.

Liquidity venues can be combined to create more complex strategies. For example, you can combine the `ERC4626` and `UniswapV3` venues to liquidate a position from a 4626 vault by first withdrawing from the vault and then swapping the underlying token for the desired token.

### Add your own venue

To add your own venue, you need to create a new folder in the `apps/liquidityVenues` folder.
This folder should contain up to 3 files:

- `index.ts`: In this file you will define the new liquidity venue that needs to implements the `LiquidityVenue` interface (located in `apps/client/src/liquidityVenues/liquidityVenue.ts`).
  This class needs to implement these two methods: `supportsRoute`(Returns true if the venue if collateral token is supported by the venue) and `convert`(Encodes the calls to the related contracts and pushes them to the encoder, and returns the new `srcToken`, `dstToken`, and `srcAmount`). Both these methods can be async, if they need to fetch data from the chain.
- `config.ts` (optional): Should contain all the configurable parameters (e.g. addresses) for the venue (if any).
- `abi.ts` (optional): Should contain all the ABIs of the contracts involved in the venue (if any).

After adding the new venue, you need to add it to the `liquidityVenues` array in the `apps/client/src/index.ts` file.
Be careful with the order of the array, as it will be the order in which the venues will be used by the bot.
