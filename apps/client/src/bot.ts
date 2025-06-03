import { type IMarket, type IMarketParams, MarketUtils } from "@morpho-org/blue-sdk";
import { executorAbi } from "executooor-viem";
import {
  erc20Abi,
  formatUnits,
  getAddress,
  maxUint256,
  type Account,
  type Address,
  type Chain,
  type Client,
  type Hex,
  type Transport,
} from "viem";
import { getGasPrice, readContract, simulateCalls, writeContract } from "viem/actions";

import type { LiquidityVenue } from "./liquidityVenues/liquidityVenue.js";
import type { Pricer } from "./pricers/pricer.js";
import { fetchLiquidatablePositions, fetchWhiteListedMarketsForVault } from "./utils/fetchers.js";
import { LiquidationEncoder } from "./utils/LiquidationEncoder.js";
import type {
  IndexerAPIResponse,
  LiquidatablePosition,
  PreLiquidatablePosition,
} from "./utils/types.js";

export interface LiquidationBotInputs {
  chainId: number;
  client: Client<Transport, Chain, Account>;
  morphoAddress: Address;
  wNative: Address;
  vaultWhitelist: Address[];
  additionalMarketsWhitelist: Hex[];
  executorAddress: Address;
  liquidityVenues: LiquidityVenue[];
  pricers?: Pricer[];
}

export class LiquidationBot {
  private chainId: number;
  private client: Client<Transport, Chain, Account>;
  private morphoAddress: Address;
  private wNative: Address;
  private vaultWhitelist: Address[];
  private additionalMarketsWhitelist: Hex[];
  private executorAddress: Address;
  private liquidityVenues: LiquidityVenue[];
  private pricers?: Pricer[];

  constructor(inputs: LiquidationBotInputs) {
    this.chainId = inputs.chainId;
    this.client = inputs.client;
    this.morphoAddress = inputs.morphoAddress;
    this.wNative = inputs.wNative;
    this.vaultWhitelist = inputs.vaultWhitelist;
    this.additionalMarketsWhitelist = inputs.additionalMarketsWhitelist;
    this.executorAddress = inputs.executorAddress;
    this.liquidityVenues = inputs.liquidityVenues;
    this.pricers = inputs.pricers;
  }

  async run() {
    const whitelistedMarketsFromVaults = [
      ...new Set(
        (
          await Promise.all(
            this.vaultWhitelist.map((vault) =>
              fetchWhiteListedMarketsForVault(this.chainId, vault),
            ),
          )
        ).flat(),
      ),
    ];

    const whitelistedMarkets = [
      ...whitelistedMarketsFromVaults,
      ...this.additionalMarketsWhitelist,
    ];

    const liquidationData = await fetchLiquidatablePositions(this.chainId, whitelistedMarkets);

    return Promise.all(liquidationData.map((data) => this.handleMarket(data)));
  }

  private async handleMarket({ market, positionsLiq, positionsPreLiq }: IndexerAPIResponse) {
    await Promise.all([
      ...positionsLiq.map((position) => this.liquidate(market, position)),
      ...positionsPreLiq.map((position) => this.preLiquidate(market, position)),
    ]);
  }

  private async liquidate(market: IMarket, position: LiquidatablePosition) {
    const { client, executorAddress } = this;

    const marketParams = market.params;

    const encoder = new LiquidationEncoder(executorAddress, client);

    if (!(await this.convertCollateralToLoan(marketParams, position.seizableCollateral, encoder)))
      return;

    encoder.erc20Approve(marketParams.loanToken, this.morphoAddress, maxUint256);

    encoder.morphoBlueLiquidate(
      this.morphoAddress,
      {
        ...marketParams,
        lltv: BigInt(marketParams.lltv),
      },
      position.user,
      position.seizableCollateral,
      0n,
      encoder.flush(),
    );

    const calls = encoder.flush();

    try {
      const success = await this.handleTx(encoder, calls, marketParams);

      if (success)
        console.log(`Liquidated ${position.user} on ${MarketUtils.getMarketId(marketParams)}`);
    } catch (error) {
      console.log(
        `Failed to liquidate ${position.user} on ${MarketUtils.getMarketId(marketParams)}`,
      );
      console.error("liquidation error", error);
    }
  }

  private async preLiquidate(market: IMarket, position: PreLiquidatablePosition) {
    const { client, executorAddress } = this;

    const marketParams = market.params;

    const encoder = new LiquidationEncoder(executorAddress, client);

    if (!(await this.convertCollateralToLoan(marketParams, position.seizableCollateral, encoder)))
      return;

    encoder.erc20Approve(marketParams.loanToken, position.preLiquidation, maxUint256);

    encoder.preLiquidate(
      position.preLiquidation,
      position.user,
      position.seizableCollateral,
      0n,
      encoder.flush(),
    );

    const calls = encoder.flush();

    try {
      const success = await this.handleTx(encoder, calls, marketParams);

      if (success)
        console.log(`Pre-liquidated ${position.user} on ${MarketUtils.getMarketId(marketParams)}`);
    } catch (error) {
      console.log(
        `Failed to pre-liquidate ${position.user} on ${MarketUtils.getMarketId(marketParams)}`,
      );
      console.error("liquidation error", error);
    }
  }

  private async handleTx(encoder: LiquidationEncoder, calls: Hex[], marketParams: IMarketParams) {
    const functionData = {
      abi: executorAbi,
      functionName: "exec_606BaXt",
      args: [calls],
    } as const;

    const [{ results }, gasPrice] = await Promise.all([
      simulateCalls(this.client, {
        account: this.client.account.address,
        calls: [
          {
            to: marketParams.loanToken,
            abi: erc20Abi,
            functionName: "balanceOf",
            args: [this.executorAddress],
          },
          { to: encoder.address, ...functionData },
          {
            to: marketParams.loanToken,
            abi: erc20Abi,
            functionName: "balanceOf",
            args: [this.executorAddress],
          },
        ],
      }),
      getGasPrice(this.client),
    ]);

    if (results[1].status !== "success") {
      console.warn(`Transaction failed in simulation: ${results[1].error}`);
      return;
    }

    if (
      !(await this.checkProfit(
        marketParams.loanToken,
        {
          beforeTx: results[0].result,
          afterTx: results[2].result,
        },
        {
          used: results[1].gasUsed,
          price: gasPrice,
        },
      ))
    )
      return false;

    // TX EXECUTION

    await writeContract(this.client, { address: encoder.address, ...functionData });

    return true;
  }

  private async convertCollateralToLoan(
    marketParams: IMarketParams,
    seizableCollateral: bigint,
    encoder: LiquidationEncoder,
  ) {
    let toConvert = {
      src: getAddress(marketParams.collateralToken),
      dst: getAddress(marketParams.loanToken),
      srcAmount: seizableCollateral,
    };

    for (const venue of this.liquidityVenues) {
      if (await venue.supportsRoute(encoder, toConvert.src, toConvert.dst))
        toConvert = await venue.convert(encoder, toConvert);

      if (toConvert.src === toConvert.dst) return true;
    }

    return false;
  }

  private async price(asset: Address, amount: bigint, pricers: Pricer[]) {
    let price: number | undefined = undefined;

    for (const pricer of pricers) {
      price = await pricer.price(this.client, asset);
      if (price !== undefined) break;
    }

    if (price === undefined) return undefined;

    const decimals =
      asset === this.wNative
        ? 18
        : await readContract(this.client, {
            address: asset,
            abi: erc20Abi,
            functionName: "decimals",
          });

    return parseFloat(formatUnits(amount, decimals)) * price;
  }

  private async checkProfit(
    loanAsset: Address,
    loanAssetBalance: {
      beforeTx: bigint | undefined;
      afterTx: bigint | undefined;
    },
    gas: {
      used: bigint;
      price: bigint;
    },
  ) {
    if (this.pricers === undefined) return true;

    if (loanAssetBalance.beforeTx === undefined || loanAssetBalance.afterTx === undefined)
      return false;

    const loanAssetProfit = loanAssetBalance.afterTx - loanAssetBalance.beforeTx;

    if (loanAssetProfit <= 0n) return false;

    const [loanAssetProfitUsd, gasUsedUsd] = await Promise.all([
      this.price(loanAsset, loanAssetProfit, this.pricers),
      this.price(this.wNative, gas.used * gas.price, this.pricers),
    ]);

    if (loanAssetProfitUsd === undefined || gasUsedUsd === undefined) return false;

    const profitUsd = loanAssetProfitUsd - gasUsedUsd;

    return profitUsd > 0;
  }
}
