import {
  FEE_TIERS,
  DEFAULT_FACTORY_ADDRESS,
  specificFactoryAddresses,
  USD_REFERENCE,
} from "@morpho-blue-liquidation-bot/config";
import {
  type Account,
  type Address,
  type Chain,
  type Client,
  type Transport,
  erc20Abi,
  formatUnits,
  fromHex,
  zeroAddress,
} from "viem";
import { readContract } from "viem/actions";

import { uniswapV3FactoryAbi, uniswapV3PoolAbi } from "../../abis/uniswapV3";
import type { Pricer } from "../pricer";

export class UniswapV3Pricer implements Pricer {
  private pools: Record<Address, Record<Address, Address[]>> = {};
  private decimals: Record<Address, number> = {};

  async price(client: Client<Transport, Chain, Account>, asset: Address) {
    const usdReference = USD_REFERENCE[client.chain.id];

    if (usdReference === undefined) return;

    /// TODO: allow multiple USD references

    if (asset === usdReference) return 1;

    const pools =
      this.getCachedPools(asset, usdReference) ??
      (await this.fetchPools(client, usdReference, asset));

    if (pools.length === 0) {
      return;
    }

    try {
      const liquidities = await Promise.all(
        pools.map(async (pool) => {
          return {
            pool,
            amount: await readContract(client, {
              address: pool,
              abi: uniswapV3PoolAbi,
              functionName: "liquidity",
            }),
          };
        }),
      );

      const biggestPool = liquidities.reduce(
        (max, liquidity) => (max !== null && liquidity.amount > max.amount ? liquidity : max),
        liquidities[0] ?? null,
      )?.pool;

      if (!biggestPool) {
        console.error(
          `No Uniswap pool found for asset: ${asset} and usdReference: ${usdReference}`,
        );
        return;
      }

      const token0 =
        fromHex(asset, "bigint") < fromHex(usdReference, "bigint") ? asset : usdReference;
      const token1 = token0 === asset ? usdReference : asset;

      const [slot0, token0Decimals, token1Decimals] = await Promise.all([
        readContract(client, {
          address: biggestPool,
          abi: uniswapV3PoolAbi,
          functionName: "slot0",
        }),
        this.getDecimals(client, token0),
        this.getDecimals(client, token1),
      ]);

      const sqrtPriceX96 = slot0[0];
      const price = Number(
        formatUnits(
          (sqrtPriceX96 / 2n ** 96n) ** 2n * 10n ** BigInt(token0Decimals),
          token1Decimals,
        ),
      );

      return token0 === asset ? price : 1 / price;
    } catch (error) {
      console.log(`Error pricing ${asset} on UniswapV3`);
      console.error(error);
      return;
    }
  }

  private getCachedPools(src: Address, dst: Address) {
    if (this.pools[src]?.[dst] !== undefined) return this.pools[src][dst];
    if (this.pools[dst]?.[src] !== undefined) return this.pools[dst][src];
    return undefined;
  }

  private async fetchPools(client: Client<Transport, Chain, Account>, src: Address, dst: Address) {
    const factoryAddress = specificFactoryAddresses[client.chain.id] ?? DEFAULT_FACTORY_ADDRESS;

    try {
      const newPools = (
        await Promise.all(
          FEE_TIERS.map(async (fee) =>
            readContract(client, {
              address: factoryAddress,
              abi: uniswapV3FactoryAbi,
              functionName: "getPool",
              args: [src, dst, fee],
            }),
          ),
        )
      ).filter((pool) => pool !== zeroAddress);

      if (this.pools[src]?.[dst] === undefined) {
        this.pools[src] = { ...this.pools[src], [dst]: newPools };
      }

      return newPools;
    } catch (error) {
      console.log(
        `Error fetching UniswapV3 pools for src: ${src} and dst: ${dst}. Check if the factory address is correct.`,
      );
      console.error(error);
      return [];
    }
  }

  private async getDecimals(client: Client<Transport, Chain, Account>, asset: Address) {
    if (this.decimals[asset] !== undefined) return this.decimals[asset];
    const decimals = await readContract(client, {
      address: asset,
      abi: erc20Abi,
      functionName: "decimals",
    });
    this.decimals[asset] = decimals;
    return decimals;
  }
}
