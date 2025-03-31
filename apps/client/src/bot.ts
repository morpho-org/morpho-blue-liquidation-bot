import {
  encodeFunctionData,
  maxUint256,
  type Account,
  type Address,
  type Chain,
  type Client,
  type Transport,
} from "viem";
import { estimateGas, writeContract } from "viem/actions";
import { executorAbi, ExecutorEncoder } from "executooor-viem";

import { fetchLiquidatablePositions, fetchWhiteListedMarketsForVault } from "./utils/fetchers.js";
import type { LiquidityVenue } from "./liquidityVenues/liquidityVenue.js";

export class LiquidationBot {
  private chainId: number;
  private client: Client<Transport, Chain, Account>;
  private morphoAddress: Address;
  private vaultWhitelist: Address[];
  private executorAddress: Address;
  private liquidationVenues: LiquidityVenue[];

  constructor(
    chainId: number,
    client: Client<Transport, Chain, Account>,
    morphoAddress: Address,
    vaultWhitelist: Address[],
    executorAddress: Address,
    liquidationVenues: LiquidityVenue[],
  ) {
    this.chainId = chainId;
    this.client = client;
    this.vaultWhitelist = vaultWhitelist;
    this.morphoAddress = morphoAddress;
    this.executorAddress = executorAddress;
    this.liquidationVenues = liquidationVenues;
  }

  async run() {
    const { client } = this;
    const { vaultWhitelist } = this;
    const whitelistedMarkets = [
      ...new Set(
        (
          await Promise.all(
            vaultWhitelist.map((vault) => fetchWhiteListedMarketsForVault(this.chainId, vault)),
          )
        ).flat(),
      ),
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
          src: marketParams.collateralToken,
          dst: marketParams.loanToken,
          srcAmount: liquidatablePosition.seizableCollateral,
        };

        const encoder = new ExecutorEncoder(executorAddress, client);

        /// LIQUIDITY VENUES

        for (const venue of this.liquidationVenues) {
          if (await venue.supportsRoute(encoder, toConvert.src, toConvert.dst))
            toConvert = await venue.convert(encoder, toConvert);

          if (toConvert.src === toConvert.dst || toConvert.srcAmount === 0n) break;
        }

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

        // TODO: maybe try/catch the simulation, and execute the tx if it succeeds
        // TODO: add a way to price loanToken and ETH to check profit

        // TX EXECUTION

        await writeContract(client, {
          address: encoder.address,
          abi: executorAbi,
          functionName: "exec_606BaXt",
          args: [calls],
        });
      }),
    );
  }
}
