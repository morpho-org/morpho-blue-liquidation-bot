import { executorAbi, ExecutorEncoder } from "executooor-viem";
import {
  encodeFunctionData,
  getAddress,
  maxUint256,
  type Account,
  type Address,
  type Chain,
  type Client,
  type Hex,
  type Transport,
} from "viem";
import { estimateGas, writeContract } from "viem/actions";

import type { LiquidityVenue } from "./liquidityVenues/liquidityVenue.js";
import { fetchWhitelistedVaults } from "./utils/fetch-whitelisted-vaults.js";
import { fetchLiquidatablePositions, fetchWhiteListedMarketsForVault } from "./utils/fetchers.js";
import type { IndexerAPIResponse, LiquidatablePosition } from "./utils/types.js";
import { MarketUtils, type IMarket } from "@morpho-org/blue-sdk";

export class LiquidationBot {
  private chainId: number;
  private client: Client<Transport, Chain, Account>;
  private morphoAddress: Address;
  private vaultWhitelist: Address[];
  private additionalMarketsWhitelist: Hex[];
  private executorAddress: Address;
  private liquidationVenues: LiquidityVenue[];

  constructor(
    chainId: number,
    client: Client<Transport, Chain, Account>,
    morphoAddress: Address,
    vaultWhitelist: Address[],
    additionalMarketsWhitelist: Hex[],
    executorAddress: Address,
    liquidationVenues: LiquidityVenue[],
  ) {
    this.chainId = chainId;
    this.client = client;
    this.vaultWhitelist = vaultWhitelist;
    this.additionalMarketsWhitelist = additionalMarketsWhitelist;
    this.morphoAddress = morphoAddress;
    this.executorAddress = executorAddress;
    this.liquidationVenues = liquidationVenues;
  }

  async run() {
    const { client } = this;

    if (this.vaultWhitelist.length === 0) {
      this.vaultWhitelist = await fetchWhitelistedVaults(this.chainId);
      console.log("Watching markets in the following vaults:");
      console.log(this.vaultWhitelist);
    }
    const vaultWhitelist = this.vaultWhitelist;
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

    const marketsLiquidationData = await fetchLiquidatablePositions(
      this.chainId,
      whitelistedMarkets,
    );

    const executorAddress = this.executorAddress;

    await Promise.all(
      marketsLiquidationData.map((marketLiquidationData) =>
        this.handleMarket(marketLiquidationData),
      ),
    );
  }

  private async handleMarket(marketLiquidationData: IndexerAPIResponse) {
    await this.liquidateOnMarket(marketLiquidationData.market, marketLiquidationData.positionsLiq);
  }

  private async liquidateOnMarket(market: IMarket, positions: LiquidatablePosition[]) {
    await Promise.all(
      positions.map(async (position) => {
        await this.liquidate(market, position);
      }),
    );
  }

  private async liquidate(market: IMarket, position: LiquidatablePosition) {
    const { client, executorAddress } = this;

    const marketParams = market.params;

    const encoder = new ExecutorEncoder(executorAddress, client);

    let toConvert = {
      src: getAddress(marketParams.collateralToken),
      dst: getAddress(marketParams.loanToken),
      srcAmount: position.seizableCollateral,
    };

    /// LIQUIDITY VENUES

    for (const venue of this.liquidationVenues) {
      if (await venue.supportsRoute(encoder, toConvert.src, toConvert.dst))
        toConvert = await venue.convert(encoder, toConvert);

      if (toConvert.src === toConvert.dst || toConvert.srcAmount === 0n) break;
    }

    if (toConvert.src !== toConvert.dst) return;

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

      const gasLimit = await estimateGas(client, populatedTx);

      // TX EXECUTION

      await writeContract(client, {
        address: encoder.address,
        abi: executorAbi,
        functionName: "exec_606BaXt",
        args: [calls],
      });

      console.log(`Liquidated ${position.user} on ${MarketUtils.getMarketId(marketParams)}`);
    } catch (error) {
      console.log(
        `Failed to liquidate ${position.user} on ${MarketUtils.getMarketId(marketParams)}`,
      );
      console.error("liquidation error", error);
    }
  }
}
