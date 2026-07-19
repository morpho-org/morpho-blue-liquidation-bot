import {
  UnsupportedVaultV2AdapterError,
  VaultV2MorphoMarketV1Adapter,
  VaultV2MorphoMarketV1AdapterV2,
  VaultV2MorphoVaultV1Adapter,
} from "@morpho-org/blue-sdk";
import {
  fetchVaultV2,
  fetchVaultV2Adapter,
  metaMorphoAbi,
  vaultV2Abi,
} from "@morpho-org/blue-sdk-viem";
import type { Account, Address, Chain, Client, Hex, Transport } from "viem";
import { zeroAddress } from "viem";
import { getChainId, readContract } from "viem/actions";

async function isMetaMorphoVault(
  client: Client<Transport, Chain, Account>,
  vaultAddress: Address,
): Promise<boolean> {
  try {
    await readContract(client, {
      address: vaultAddress,
      abi: metaMorphoAbi,
      functionName: "withdrawQueueLength",
    });
    return true;
  } catch {
    return false;
  }
}

async function isVaultV2(
  client: Client<Transport, Chain, Account>,
  vaultAddress: Address,
): Promise<boolean> {
  try {
    await readContract(client, {
      address: vaultAddress,
      abi: vaultV2Abi,
      functionName: "adaptersLength",
    });
    return true;
  } catch {
    return false;
  }
}

async function fetchMetaMorphoVaultMarkets(
  client: Client<Transport, Chain, Account>,
  vaultAddress: Address,
): Promise<Hex[]> {
  const withdrawQueueLength = await readContract(client, {
    address: vaultAddress,
    abi: metaMorphoAbi,
    functionName: "withdrawQueueLength",
  });

  const indices = Array.from({ length: Number(withdrawQueueLength) }, (_, i) => BigInt(i));

  return Promise.all(
    indices.map(async (index) =>
      readContract(client, {
        address: vaultAddress,
        abi: metaMorphoAbi,
        functionName: "withdrawQueue",
        args: [index],
      }),
    ),
  );
}

async function fetchVaultV2Markets(
  client: Client<Transport, Chain, Account>,
  vaultAddress: Address,
  chainId: number,
  logPrefix: string,
): Promise<Hex[]> {
  const vault = await fetchVaultV2(vaultAddress, client, {
    chainId,
    deployless: false,
  });

  const adapterAddresses = new Set<Address>(vault.adapters);
  if (vault.liquidityAdapter !== zeroAddress) {
    adapterAddresses.add(vault.liquidityAdapter);
  }

  const marketIds: Hex[] = [];

  for (const adapterAddress of adapterAddresses) {
    try {
      const adapter = await fetchVaultV2Adapter(adapterAddress, client, {
        chainId,
        deployless: false,
      });

      if (adapter instanceof VaultV2MorphoMarketV1AdapterV2) {
        marketIds.push(...adapter.marketIds);
        continue;
      }

      if (adapter instanceof VaultV2MorphoMarketV1Adapter) {
        console.warn(
          `${logPrefix} Skipping MorphoMarketV1Adapter ${adapterAddress} on vault ${vaultAddress}: only MorphoMarketV1AdapterV2 is supported for market discovery`,
        );
        continue;
      }

      if (adapter instanceof VaultV2MorphoVaultV1Adapter) {
        console.warn(
          `${logPrefix} Skipping MorphoVaultV1Adapter ${adapterAddress} on vault ${vaultAddress}: nested MetaMorpho V1 adapters are not supported for market discovery`,
        );
        continue;
      }

      console.warn(
        `${logPrefix} Skipping unknown adapter ${adapterAddress} on vault ${vaultAddress}`,
      );
    } catch (error) {
      if (error instanceof UnsupportedVaultV2AdapterError) {
        console.warn(
          `${logPrefix} Skipping unsupported adapter ${adapterAddress} on vault ${vaultAddress}`,
        );
        continue;
      }

      console.error(
        `${logPrefix} Error fetching adapter ${adapterAddress} for vault ${vaultAddress}:`,
        error,
      );
    }
  }

  return marketIds;
}

/**
 * Discover Morpho Blue market IDs whitelisted by a MetaMorpho V1 or Vault V2 address.
 */
export async function fetchVaultMarkets(
  client: Client<Transport, Chain, Account>,
  vaultAddress: Address,
): Promise<Hex[]> {
  const chainId = await getChainId(client);
  const logPrefix = `[Chain ${chainId}]`;

  try {
    if (await isMetaMorphoVault(client, vaultAddress)) {
      return await fetchMetaMorphoVaultMarkets(client, vaultAddress);
    }

    if (await isVaultV2(client, vaultAddress)) {
      return await fetchVaultV2Markets(client, vaultAddress, chainId, logPrefix);
    }

    console.warn(
      `${logPrefix} Unknown vault type for ${vaultAddress}: neither MetaMorpho V1 nor Vault V2`,
    );
    return [];
  } catch (error) {
    console.error(`${logPrefix} Error fetching vault markets for ${vaultAddress}:`, error);
    return [];
  }
}
