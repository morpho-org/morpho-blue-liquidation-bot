import type { DataProviderName } from "@morpho-blue-liquidation-bot/config";

import { DataProvider } from "./dataProvider";
import { HyperIndexDataProvider } from "./hyperIndex";
import { MorphoApiDataProvider } from "./morphoApi";

/**
 * Creates a data provider instance based on the data provider name from config.
 * This factory function avoids circular dependencies by keeping data provider
 * class imports in the client package, while config only exports string identifiers.
 */
export function createDataProvider(dataProviderName: DataProviderName): DataProvider {
  switch (dataProviderName) {
    case "morphoApi":
      return new MorphoApiDataProvider();
    case "hyperIndex":
      return new HyperIndexDataProvider();
    default:
      throw new Error(`Unknown data provider: ${dataProviderName}`);
  }
}
