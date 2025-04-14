import type { ExecutorEncoder } from "executooor-viem";
import { type Address, encodeFunctionData, maxUint256, zeroAddress } from "viem";
import { readContract } from "viem/actions";

import type { ToConvert } from "../../utils/types";
import type { LiquidityVenue } from "../liquidityVenue";

import { swapRouterAbi, uniswapV3FactoryAbi, uniswapV3PoolAbi } from "./abis";
import {
  FEE_TIERS,
  DEFAULT_FACTORY_ADDRESS,
  DEFAULT_ROUTER_ADDRESS,
  specificAddresses,
} from "@morpho-blue-liquidation-bot/config";

export class UniswapV3 implements LiquidityVenue {
  private pools: Record<Address, Record<Address, { address: Address; fee: number }[]>> = {};

  async supportsRoute(encoder: ExecutorEncoder, src: Address, dst: Address) {
    if (src === dst) return false;

    const pools = this.getCachedPools(src, dst);

    if (pools !== undefined) return pools.filter((pool) => pool.address !== zeroAddress).length > 0;

    return await this.fetchPools(encoder, src, dst);
  }

  async convert(encoder: ExecutorEncoder, toConvert: ToConvert) {
    const addresses = specificAddresses[encoder.client.chain.id] ?? {
      factory: DEFAULT_FACTORY_ADDRESS,
      router: DEFAULT_ROUTER_ADDRESS,
    };

    if (addresses === undefined) {
      throw new Error("Uniswap V3 is not supported on this chain");
    }

    const { router } = addresses;
    const { src, dst, srcAmount } = toConvert;

    const pools = this.getCachedPools(src, dst);

    if (pools === undefined) {
      return toConvert;
    }

    const liquidities = await Promise.all(
      pools.map(async (pool) => {
        return {
          ...pool,
          amount: await readContract(encoder.client, {
            address: pool.address,
            abi: uniswapV3PoolAbi,
            functionName: "liquidity",
          }),
        };
      }),
    );
    const bestFeeTier = liquidities.reduce(
      (max, liquidity) => (max !== null && liquidity.amount > max.amount ? liquidity : max),
      liquidities[0] ?? null,
    )?.fee;

    if (!bestFeeTier) {
      throw new Error("No Uniswap pool found");
    }

    encoder.erc20Approve(src, router, srcAmount);
    encoder.pushCall(
      router,
      0n,
      encodeFunctionData({
        abi: swapRouterAbi,
        functionName: "exactInputSingle",
        args: [
          {
            tokenIn: src,
            tokenOut: dst,
            fee: bestFeeTier,
            recipient: encoder.address,
            deadline: maxUint256,
            amountIn: srcAmount,
            amountOutMinimum: 0n,
            sqrtPriceLimitX96: 0n,
          },
        ],
      }),
    );

    /// assumed to be the last liquidity venue
    return {
      src: dst,
      dst: dst,
      srcAmount: 0n,
    };
  }

  private getCachedPools(src: Address, dst: Address) {
    if (this.pools[src]?.[dst] !== undefined) return this.pools[src][dst];
    if (this.pools[dst]?.[src] !== undefined) return this.pools[dst][src];
    return undefined;
  }

  private async fetchPools(encoder: ExecutorEncoder, src: Address, dst: Address) {
    const addresses = specificAddresses[encoder.client.chain.id] ?? {
      factory: DEFAULT_FACTORY_ADDRESS,
      router: DEFAULT_ROUTER_ADDRESS,
    };

    if (addresses === undefined) {
      throw new Error("Uniswap V3 is not supported on this chain");
    }

    const { factory } = addresses;

    const newPools = (
      await Promise.all(
        FEE_TIERS.map(async (fee) => {
          return {
            address: await readContract(encoder.client, {
              address: factory,
              abi: uniswapV3FactoryAbi,
              functionName: "getPool",
              args: [src, dst, fee],
            }),
            fee,
          };
        }),
      )
    ).filter((pool) => pool.address !== zeroAddress);

    if (this.pools[src]?.[dst] === undefined) {
      this.pools[src] = { ...this.pools[src], [dst]: newPools };
    }

    return newPools.filter((pool) => pool.address !== zeroAddress).length > 0;
  }
}
