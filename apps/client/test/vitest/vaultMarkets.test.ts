import {
  MorphoApiDataProvider,
  HyperIndexDataProvider,
} from "@morpho-blue-liquidation-bot/data-providers";
import { VaultV2MorphoMarketV1AdapterV2 } from "@morpho-org/blue-sdk";
import { fetchVaultV2Adapter, metaMorphoAbi } from "@morpho-org/blue-sdk-viem";
import type { Address, Hex } from "viem";
import { readContract } from "viem/actions";
import { describe, expect, vi } from "vitest";

import { steakUSDC } from "../constants.js";
import { vaultV2Test } from "../setup.js";

const SKY_VAULT_V2 = "0xE15fcC81118895b67b6647BBd393182dF44E11E0" as Address;
const SKY_ADAPTER_V2 = "0xf94BE39e8863183Ff41194b5923627C90A34039D" as Address;

async function expectedMetaMorphoMarkets(
  client: Parameters<MorphoApiDataProvider["fetchMarkets"]>[0],
  vaultAddress: Address,
): Promise<Hex[]> {
  const withdrawQueueLength = await readContract(client, {
    address: vaultAddress,
    abi: metaMorphoAbi,
    functionName: "withdrawQueueLength",
  });

  return Promise.all(
    Array.from({ length: Number(withdrawQueueLength) }, (_, index) =>
      readContract(client, {
        address: vaultAddress,
        abi: metaMorphoAbi,
        functionName: "withdrawQueue",
        args: [BigInt(index)],
      }),
    ),
  );
}

describe("fetchVaultMarkets", () => {
  vaultV2Test("resolves MetaMorpho V1 vault markets from withdrawQueue", async ({ client }) => {
    const provider = new MorphoApiDataProvider();
    const markets = await provider.fetchMarkets(client, [steakUSDC]);
    const expected = await expectedMetaMorphoMarkets(client, steakUSDC);

    expect([...markets].sort()).toEqual([...new Set(expected)].sort());
  });

  vaultV2Test(
    "resolves Vault V2 markets from MorphoMarketV1AdapterV2 adapters",
    async ({ client }) => {
      const morphoApiProvider = new MorphoApiDataProvider();
      const hyperIndexProvider = new HyperIndexDataProvider({ url: "http://localhost:0" });

      const adapter = await fetchVaultV2Adapter(SKY_ADAPTER_V2, client, {
        deployless: false,
      });

      expect(adapter).toBeInstanceOf(VaultV2MorphoMarketV1AdapterV2);
      if (!(adapter instanceof VaultV2MorphoMarketV1AdapterV2)) {
        throw new Error("Expected MorphoMarketV1AdapterV2");
      }

      expect(adapter.marketIds.length).toBeGreaterThan(0);

      const expectedMarkets = [...adapter.marketIds].sort();

      const morphoApiMarkets = await morphoApiProvider.fetchMarkets(client, [SKY_VAULT_V2]);
      const hyperIndexMarkets = await hyperIndexProvider.fetchMarkets(client, [SKY_VAULT_V2]);

      expect([...morphoApiMarkets].sort()).toEqual(expectedMarkets);
      expect([...hyperIndexMarkets].sort()).toEqual(expectedMarkets);
    },
  );

  vaultV2Test("warns and returns no markets for unknown vault addresses", async ({ client }) => {
    const provider = new MorphoApiDataProvider();
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    const unknownVault = "0x0000000000000000000000000000000000000001" as Address;
    const markets = await provider.fetchMarkets(client, [unknownVault]);

    expect(markets).toEqual([]);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining(`Unknown vault type for ${unknownVault}`),
    );

    warnSpy.mockRestore();
  });
});
