import { executorAbi, type ExecutorEncoder } from "executooor-viem";
import {
  type Address,
  encodeAbiParameters,
  encodeFunctionData,
  erc20Abi,
  fromHex,
  zeroAddress,
} from "viem";
import { readContract } from "viem/actions";

import type { ToConvert } from "../../utils/types";
import type { LiquidityVenue } from "../liquidityVenue";

import { uniswapV3FactoryAbi, uniswapV3PoolAbi } from "./abis";
import {
  FEE_TIERS,
  DEFAULT_FACTORY_ADDRESS,
  specificFactoryAddresses,
  MAX_SQRT_RATIO,
  MIN_SQRT_RATIO,
} from "@morpho-blue-liquidation-bot/config";

export class UniswapV3 implements LiquidityVenue {
  private pools: Record<Address, Record<Address, Address[]>> = {};

  async supportsRoute(encoder: ExecutorEncoder, src: Address, dst: Address) {
    if (src === dst) return false;

    const pools = this.getCachedPools(src, dst) ?? (await this.fetchPools(encoder, src, dst));

    return pools !== undefined && pools.length > 0;
  }

  async convert(encoder: ExecutorEncoder, toConvert: ToConvert) {
    const { src, dst, srcAmount } = toConvert;

    const pools = this.getCachedPools(src, dst);

    if (pools === undefined) {
      return toConvert;
    }

    try {
      const liquidities = await Promise.all(
        pools.map(async (pool) => {
          return {
            pool,
            amount: await readContract(encoder.client, {
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
        throw new Error("No Uniswap pool found");
      }

      const zeroForOne = fromHex(src, "bigint") < fromHex(dst, "bigint");

      const encodedContext =
        `0x${0n.toString(16).padStart(24, "0") + zeroAddress.substring(2)}` as const;
      const callbacks = [
        encodeFunctionData({
          abi: executorAbi,
          functionName: "call_g0oyU7o",
          args: [
            src,
            0n,
            encodedContext,
            encodeFunctionData({
              abi: erc20Abi,
              functionName: "transfer",
              args: [biggestPool, srcAmount],
            }),
          ],
        }),
      ];

      encoder.pushCall(
        biggestPool,
        0n,
        encodeFunctionData({
          abi: uniswapV3PoolAbi,
          functionName: "swap",
          args: [
            encoder.address,
            zeroForOne,
            srcAmount,
            zeroForOne ? MIN_SQRT_RATIO + 1n : MAX_SQRT_RATIO - 1n,
            encodeAbiParameters([{ type: "bytes[]" }, { type: "bytes" }], [callbacks, "0x"]),
          ],
        }),
        {
          sender: biggestPool,
          dataIndex: 2n, // uniswapV3SwapCallback(int256,int256,bytes)
        },
      );

      /// assumed to be the last liquidity venue
      return {
        src: dst,
        dst: dst,
        srcAmount: 0n,
      };
    } catch (error) {
      console.log(`Error converting ${src} to ${dst}`);
      console.error(error);
      return toConvert;
    }
  }

  private getCachedPools(src: Address, dst: Address) {
    if (this.pools[src]?.[dst] !== undefined) return this.pools[src][dst];
    if (this.pools[dst]?.[src] !== undefined) return this.pools[dst][src];
    return undefined;
  }

  private async fetchPools(encoder: ExecutorEncoder, src: Address, dst: Address) {
    const factoryAddress =
      specificFactoryAddresses[encoder.client.chain.id] ?? DEFAULT_FACTORY_ADDRESS;

    try {
      const newPools = (
        await Promise.all(
          FEE_TIERS.map(async (fee) =>
            readContract(encoder.client, {
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
      return undefined;
    }
  }
}
