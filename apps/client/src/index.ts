import { chainConfigs } from "../config.js";
import { fetchWhiteListedMarkets } from "./utils/fetchers.js";

export async function main() {
  const args = process.argv.slice(2);
  const chainIdArg = args.find((arg) => arg.startsWith("--chainId="));

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

  return whitelistedMarkets;
}
