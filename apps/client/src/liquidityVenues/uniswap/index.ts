import type { ExecutorEncoder } from "executooor-viem";
import { type Address, encodeFunctionData, maxUint256, zeroAddress } from "viem";
import { readContract } from "viem/actions";

import type { ToConvert } from "../../utils/types";
import type { LiquidityVenue } from "../liquidityVenue";

import { swapRouterAbi, uniswapV3FactoryAbi, uniswapV3PoolAbi } from "./abis";
import { FEE_TIERS, UNISWAP_ADDRESSES } from "./config";

export class UniswapV3 implements LiquidityVenue {
  private pools: { address: Address; fee: number }[] = [];

  async supportsRoute(encoder: ExecutorEncoder, src: Address, dst: Address) {
    if (src === dst) return false;

    const addresses = UNISWAP_ADDRESSES[encoder.client.chain.id];

    if (addresses === undefined) {
      throw new Error("Uniswap V3 is not supported on this chain");
    }

    const { factory } = addresses;

    const pools = (
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

    this.pools = pools;

    return pools.length > 0;
  }

  async convert(encoder: ExecutorEncoder, toConvert: ToConvert) {
    const addresses = UNISWAP_ADDRESSES[encoder.client.chain.id];

    if (addresses === undefined) {
      throw new Error("Uniswap V3 is not supported on this chain");
    }

    const { router } = addresses;
    const { src, dst, srcAmount } = toConvert;

    const liquidities = await Promise.all(
      this.pools.map(async (pool) => {
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
    return toConvert;
  }
}
