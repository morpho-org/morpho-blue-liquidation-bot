import type { Account, Address, Chain, Client, Transport } from "viem";
import { sendTransaction, simulateCalls } from "viem/actions";
import { ExecutorEncoder } from "executooor-viem";

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

        encoder.morphoBlueLiquidate(
          this.morphoAddress,
          liquidatablePosition.marketParams,
          liquidatablePosition.position.user,
          liquidatablePosition.seizableCollateral,
          0n,
          encoder.flush(),
        );

        const liquidationCall = encoder.flush()[0];

        /// TX SIMULATION

        const { results } = await simulateCalls(encoder.client, {
          calls: [
            {
              to: encoder.address,
              data: liquidationCall,
            },
          ],
        });

        // TX EXECUTION

        if (results[0].status === "success") {
          await sendTransaction(client, {
            to: encoder.address,
            data: liquidationCall,
          });
        }
      }),
    );
  }
}
