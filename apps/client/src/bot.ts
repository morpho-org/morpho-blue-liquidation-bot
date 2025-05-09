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
import { readContract, simulateCalls, writeContract } from "viem/actions";
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

          const { results, assetChanges } = await simulateCalls(client, {
            account: client.account.address,
            calls: [populatedTx],
            traceAssetChanges: true,
          });

          if (this.pricers) {
            const loanAssetChange = assetChanges.find(
              (asset) => asset.token.address === marketParams.loanToken,
            );

            if (loanAssetChange === undefined || loanAssetChange.value.diff <= 0n) return;

            const loanAssetProfit = loanAssetChange.value.diff;

            const [loanAssetProfitUsd, gasUsedUsd] = await Promise.all([
              this.price(marketParams.loanToken, loanAssetProfit, this.pricers),
              this.price(this.wNative, results[0].gasUsed, this.pricers),
            ]);

            if (loanAssetProfitUsd === undefined || gasUsedUsd === undefined) return;

            const profitUsd = loanAssetProfitUsd - gasUsedUsd;

            if (profitUsd <= 0) return;
          }

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
        price = await pricer.price(this.client, this.chainId, asset);

        if (price !== undefined) break;
      }
    }

    if (price === undefined) return undefined;

    const decimals = await readContract(this.client, {
      address: asset,
      abi: erc20Abi,
      functionName: "decimals",
    });

    return (Number(amount) / 10 ** decimals) * price;
  }
}
