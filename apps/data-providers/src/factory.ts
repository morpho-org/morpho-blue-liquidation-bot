import type { DataProviderName } from "@morpho-blue-liquidation-bot/config";

import type { DataProvider } from "./dataProvider";
import { HyperIndexDataProvider } from "./hyperIndex";
import { MorphoApiDataProvider } from "./morphoApi";

/**
 * Creates data providers for the given chains.
 * Returns a Map from chainId to DataProvider.
 * Multi-chain providers (morphoApi, hyperIndex) share a single instance across all chains.
 */
export async function createDataProviders(
  dataProviderName: DataProviderName,
  chainIds: number[],
): Promise<Map<number, DataProvider>> {
  let provider: DataProvider;

  switch (dataProviderName) {
    case "morphoApi":
      provider = new MorphoApiDataProvider();
      break;
    case "hyperIndex":
      provider = new HyperIndexDataProvider();
      break;
    default:
      throw new Error(`Unknown data provider: ${dataProviderName}`);
  }

  if (provider.init) {
    await provider.init();
  }

  const map = new Map<number, DataProvider>();
  for (const chainId of chainIds) {
    map.set(chainId, provider);
  }
  return map;
}
