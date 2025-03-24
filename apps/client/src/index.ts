import { createWalletClient, encodeAbiParameters, http } from "viem";
import { simulateCalls } from "viem/actions";
import { privateKeyToAccount } from "viem/accounts";

import { ExecutorEncoder } from "executooor-viem";

import { chainConfigs } from "../config.js";
import { fetchLiquidatablePositions, fetchWhiteListedMarketsForVault } from "./utils/fetchers.js";

import { Erc4626 } from "./liquidityVenues/erc4626/index.js";
import { Erc20Wrapper } from "./liquidityVenues/erc20Wrapper/index.js";
import { UniswapV3Swap } from "./liquidityVenues/uniswap/index.js";

import { morphoBlueAbi } from "../../ponder/abis/MorphoBlue";

export async function main() {
  const args = process.argv.slice(2);
  const chainIdArg = args.find((arg) => arg.startsWith("--chainId="));

  /// TODO: import address from config. I think their should be only one config file for both apps
  const MORPHO_ADDRESS = "0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb";

  if (chainIdArg === undefined) {
    throw new Error("Chain ID is missing");
  }
  const chainId = Number(chainIdArg);

  if (chainConfigs[chainId] === undefined) {
    throw new Error(`Chain ${chainId} not supported`);
  }

  const { vaultWhitelist } = chainConfigs[chainId];
  const whitelistedMarkets = [
    ...new Set(
      (
        await Promise.all(
          vaultWhitelist.map((vault) => fetchWhiteListedMarketsForVault(chainId, vault)),
        )
      ).flat(),
    ),
  ];

  const liquidatablePositions = await fetchLiquidatablePositions(chainId, whitelistedMarkets);

  const client = createWalletClient({
    chain: chainConfigs[chainId].chain,
    transport: http(chainConfigs[chainId].rpcUrl),
    account: privateKeyToAccount(chainConfigs[chainId].liquidationPrivateKey),
  });
  const executorAddress = chainConfigs[chainId].executorAddress;

  await Promise.all(
    liquidatablePositions.map(async (liquidatablePosition) => {
      let toConvert = {
        src: liquidatablePosition.marketParams.loanToken,
        dst: liquidatablePosition.marketParams.collateralToken,
        srcAmount: liquidatablePosition.seizableCollateral,
      };

      const encoder = new ExecutorEncoder(executorAddress, client);

      /// LIQUIDITY VENUES

      /// Erc20Wrapper
      const erc20Wrapper = new Erc20Wrapper();
      if (erc20Wrapper.supportsRoute(encoder, toConvert.src, toConvert.dst))
        toConvert = erc20Wrapper.convert(encoder, toConvert);

      /// Erc4626
      const erc4626 = new Erc4626();
      if (await erc4626.supportsRoute(encoder, toConvert.src, toConvert.dst))
        toConvert = await erc4626.convert(encoder, toConvert);

      /// UniswapV3
      const uniswapV3Swap = new UniswapV3Swap();
      if (await uniswapV3Swap.supportsRoute(encoder, toConvert.src, toConvert.dst))
        toConvert = await uniswapV3Swap.convert(encoder, toConvert);

      const callbacks = encoder.flush();

      /// TX SIMULATION

      const { results } = await simulateCalls(encoder.client, {
        calls: [
          {
            to: MORPHO_ADDRESS,
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
          MORPHO_ADDRESS,
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
