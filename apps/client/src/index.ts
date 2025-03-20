import { type Address, createWalletClient, encodeAbiParameters, http } from "viem";
import { simulateCalls } from "viem/actions";
import { privateKeyToAccount } from "viem/accounts";

import { ExecutorEncoder } from "executooor-viem";

import { chainConfigs } from "../config.js";
import { fetchLiquidatablePositions, fetchWhiteListedMarketsForVault } from "./utils/fetchers.js";

import { morphoBlueAbi } from "../../ponder/abis/MorphoBlue";
import type { ChainConfig } from "./utils/types.js";
import type { LiquidityVenue } from "./liquidityVenues/liquidityVenue.js";

class LiquidationBot {
  private chainId: number;
  private chainConfig: ChainConfig;

  private liquidationVenues: LiquidityVenue[];

  /// TODO: import address from config. I think their should be only one config file for both apps
  MORPHO_ADDRESS = "0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb" as Address;

  constructor(chainId: number, liquidationVenues: LiquidityVenue[]) {
    if (chainConfigs[chainId] === undefined) {
      throw new Error(`Chain ${chainId} not supported`);
    }

    this.chainId = chainId;
    this.chainConfig = chainConfigs[chainId];
    this.liquidationVenues = liquidationVenues;
  }

  async run() {
    const { vaultWhitelist } = this.chainConfig;
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

    const client = createWalletClient({
      chain: this.chainConfig.chain,
      transport: http(this.chainConfig.rpcUrl),
      account: privateKeyToAccount(this.chainConfig.liquidationPrivateKey),
    });
    const executorAddress = this.chainConfig.executorAddress;

    await Promise.all(
      liquidatablePositions.map(async (liquidatablePosition) => {
        let toConvert = {
          src: liquidatablePosition.marketParams.loanToken,
          dst: liquidatablePosition.marketParams.collateralToken,
          srcAmount: liquidatablePosition.seizableCollateral,
        };

        const encoder = new ExecutorEncoder(executorAddress, client);

        /// LIQUIDITY VENUES

        for (const venue of this.liquidationVenues) {
          if (await venue.supportsRoute(encoder, toConvert.src, toConvert.dst))
            toConvert = await venue.convert(encoder, toConvert);
        }

        const callbacks = encoder.flush();

        /// TX SIMULATION

        const { results } = await simulateCalls(encoder.client, {
          calls: [
            {
              to: this.MORPHO_ADDRESS,
              abi: morphoBlueAbi,
              functionName: "liquidate",
              args: [
                liquidatablePosition.marketParams,
                liquidatablePosition.position.user,
                liquidatablePosition.seizableCollateral,
                0n,
                encodeAbiParameters(
                  [{ type: "bytes[]" }, { type: "bytes" }],
                  [encoder.flush(), "0x"],
                ),
              ],
            },
          ],
        });

        if (results[0].status === "success") {
          encoder.morphoBlueLiquidate(
            this.MORPHO_ADDRESS,
            liquidatablePosition.marketParams,
            liquidatablePosition.position.user,
            liquidatablePosition.seizableCollateral,
            0n,
            callbacks,
          );

          /// TODO: execute the tx
        }
      }),
    );
  }
}
