import { createWalletClient, http } from "viem";
import { chainConfigs } from "../config.js";
import { fetchLiquidatablePositions, fetchWhiteListedMarkets } from "./utils/fetchers.js";
import { ExecutorEncoder } from "executooor-viem";
import { privateKeyToAccount } from "viem/accounts";
import { UniswapV3Swap } from "./liquidityVenues/uniswap/index.js";

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
        await Promise.all(vaultWhitelist.map((vault) => fetchWhiteListedMarkets(chainId, vault)))
      ).flat(),
    ),
  ];

  const liquidatablePositions = await fetchLiquidatablePositions(chainId, whitelistedMarkets);

  const client = createWalletClient({
    chain: chainConfigs[chainId].chain,
    transport: http(chainConfigs[chainId].rpcUrl),
    account: privateKeyToAccount(chainConfigs[chainId].liquidationPrivateKey),
  });

  const encoder = new ExecutorEncoder(chainConfigs[chainId].executorAddress, client);

  await Promise.all(
    // Warning: this parallelization might be wrong as calls could be misordered
    liquidatablePositions.map(async (liquidatablePosition) => {
      const toConvert = {
        src: liquidatablePosition.marketParams.loanToken,
        dst: liquidatablePosition.marketParams.collateralToken,
        srcAmount: liquidatablePosition.seizableCollateral,
      };

      /// TODO: populate with other liquidity venues

      /// UniswapV3
      const uniswapV3Swap = new UniswapV3Swap();
      if (await uniswapV3Swap.supportsRoute(encoder, toConvert.src, toConvert.dst))
        await uniswapV3Swap.convert(encoder, toConvert);

      encoder.morphoBlueLiquidate(
        MORPHO_ADDRESS,
        liquidatablePosition.marketParams,
        liquidatablePosition.position.user,
        liquidatablePosition.seizableCollateral,
        0n,
        encoder.flush(),
      );
    }),
  );

  /// TODO: simulate and execute the txs
  /// REMARK: here we try to batch all the txs. This might not be a good idea as if one tx reverts, the whole batch will revert.
}
