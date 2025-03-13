import type { ExecutorEncoder } from "executooor-viem";
import type { ToConvert } from "../../utils";
import { FEE_TIERS, UNISWAP_ADDRESSES } from "./config";
import { readContract } from "viem/actions";
import { swapRouterAbi, uniswapV3FactoryAbi, uniswapV3PoolAbi } from "./abis";
import { type Address, encodeFunctionData, maxUint256, zeroAddress } from "viem";
import type { LiquidityVenue } from "../liquidityVenue";
export class uniswapV3Swap implements LiquidityVenue {
  isAdaptedTo(toConvert: ToConvert): boolean {
    return true;
  }

  async convert(encoder: ExecutorEncoder, toConvert: ToConvert) {
    const addresses = UNISWAP_ADDRESSES[encoder.client.chain.id];

    if (addresses === undefined) {
      throw new Error("Uniswap V3 is not supported on this chain");
    }

    const { factory, router } = addresses;
    const { src, dst, srcAmount } = toConvert;

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
  }
}
