import {
  encodeFunctionData,
  erc20Abi,
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
import { executorAbi, ExecutorEncoder } from "executooor-viem";

import { fetchLiquidatablePositions, fetchWhiteListedMarketsForVault } from "./utils/fetchers.js";
import type { LiquidityVenue } from "./liquidityVenues/liquidityVenue.js";
import type { Pricer } from "./pricers/pricer.js";

export type LiquidationBotInputs = {
  chainId: number;
  client: Client<Transport, Chain, Account>;
  morphoAddress: Address;
  wNative: Address;
  vaultWhitelist: Address[];
  additionalMarketsWhitelist: Hex[];
  executorAddress: Address;
  liquidityVenues: LiquidityVenue[];
  pricers?: Pricer[];
};

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
    this.vaultWhitelist = inputs.vaultWhitelist;
    this.additionalMarketsWhitelist = inputs.additionalMarketsWhitelist;
    this.morphoAddress = inputs.morphoAddress;
    this.wNative = inputs.wNative;
    this.executorAddress = inputs.executorAddress;
    this.liquidityVenues = inputs.liquidityVenues;
    this.pricers = inputs.pricers;
  }

  async run() {
    const { client } = this;
    const { vaultWhitelist } = this;
    const whitelistedMarketsFromVaults = [
      ...new Set(
        (
          await Promise.all(
            vaultWhitelist.map((vault) => fetchWhiteListedMarketsForVault(this.chainId, vault)),
          )
        ).flat(),
      ),
    ];

    const whitelistedMarkets = [
      ...whitelistedMarketsFromVaults,
      ...this.additionalMarketsWhitelist,
    ];

    const liquidatablePositions = await fetchLiquidatablePositions(
      this.chainId,
      whitelistedMarkets,
    );

    const executorAddress = this.executorAddress;

    await Promise.all(
      liquidatablePositions.map(async (liquidatablePosition) => {
        const { marketParams } = liquidatablePosition;

        let toConvert = {
          src: getAddress(marketParams.collateralToken),
          dst: getAddress(marketParams.loanToken),
          srcAmount: liquidatablePosition.seizableCollateral,
        };

        const encoder = new ExecutorEncoder(executorAddress, client);

        /// LIQUIDITY VENUES

        for (const venue of this.liquidityVenues) {
          if (await venue.supportsRoute(encoder, toConvert.src, toConvert.dst))
            toConvert = await venue.convert(encoder, toConvert);

          if (toConvert.src === toConvert.dst || toConvert.srcAmount === 0n) break;
        }

        if (toConvert.src !== toConvert.dst) return;

        encoder.erc20Approve(marketParams.loanToken, this.morphoAddress, maxUint256);

        encoder.morphoBlueLiquidate(
          this.morphoAddress,
          marketParams,
          liquidatablePosition.position.user,
          liquidatablePosition.seizableCollateral,
          0n,
          encoder.flush(),
        );

        const calls = encoder.flush();

        try {
          /// TX SIMULATION

          const populatedTx = {
            to: encoder.address,
            data: encodeFunctionData({
              abi: executorAbi,
              functionName: "exec_606BaXt",
              args: [calls],
            }),
            value: 0n, // TODO: find a way to get encoder value
          };

          const [{ results }, gasPrice] = await Promise.all([
            simulateCalls(client, {
              account: client.account.address,
              calls: [
                {
                  to: marketParams.loanToken,
                  abi: erc20Abi,
                  functionName: "balanceOf",
                  args: [executorAddress],
                },
                populatedTx,
                {
                  to: marketParams.loanToken,
                  abi: erc20Abi,
                  functionName: "balanceOf",
                  args: [executorAddress],
                },
              ],
            }),
            getGasPrice(client),
          ]);

          if (results[1].status !== "success") return;

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
            return;

          // TX EXECUTION

          await writeContract(client, {
            address: encoder.address,
            abi: executorAbi,
            functionName: "exec_606BaXt",
            args: [calls],
          });

          console.log(
            `Liquidated ${liquidatablePosition.position.user} on ${liquidatablePosition.position.marketId}`,
          );
        } catch (error) {
          console.log(
            `Failed to liquidate ${liquidatablePosition.position.user} on ${liquidatablePosition.position.marketId}`,
          );
          console.error("liquidation error", error);
        }
      }),
    );
  }

  private async price(asset: Address, amount: bigint, pricers: Pricer[]) {
    let price = undefined;

    for (const pricer of pricers) {
      if (await pricer.supportsChain(this.chainId)) {
        if (await pricer.supportsAsset(this.client, asset)) {
          price = await pricer.price(this.client, asset);
          if (price !== undefined) break;
        }
      }
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

    return (Number(amount) / 10 ** decimals) * price;
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
