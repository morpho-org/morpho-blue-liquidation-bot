import type { ExecutorEncoder } from "executooor-viem";
import type { AdditionalParams, ToConvert } from "../../utils";
import { FEE_TIERS, UNISWAP_ADDRESSES } from "./config";
import { readContract, simulateCalls } from "viem/actions";
import { swapRouterAbi, uniswapV3FactoryAbi, uniswapV3PoolAbi } from "./abis";
import {
  type Address,
  encodeAbiParameters,
  encodeFunctionData,
  maxUint256,
  zeroAddress,
} from "viem";
import type { LiquidityVenue } from "../liquidityVenue";
import { morphoBlueAbi } from "../../../../ponder/abis/MorphoBlue";

export class uniswapV3Swap implements LiquidityVenue {
  private readonly MORPHO_ADDRESS: Address = "0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb"; // TODO: import from ponder

  isAdaptedTo(toConvert: ToConvert): boolean {
    return true;
  }

  async convert(
    encoder: ExecutorEncoder,
    toConvert: ToConvert,
    additionalParams: AdditionalParams,
  ) {
    const addresses = UNISWAP_ADDRESSES[encoder.client.chain.id];

    if (addresses === undefined) {
      throw new Error("Uniswap V3 is not supported on this chain");
    }

    const { marketParams, borrower } = additionalParams;

    if (!marketParams) throw new Error("Market params not parsed");
    if (!borrower) throw new Error("Borrower not parsed");

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

    this.encodeCallback(encoder, src, dst, srcAmount, bestFeeTier, router);

    const { results } = await simulateCalls(encoder.client, {
      calls: [
        {
          to: this.MORPHO_ADDRESS,
          abi: morphoBlueAbi,
          functionName: "liquidate",
          args: [
            marketParams,
            borrower,
            srcAmount,
            0n,
            encodeAbiParameters([{ type: "bytes[]" }, { type: "bytes" }], [encoder.flush(), "0x"]),
          ],
        },
      ],
    });

    if (!results.every((result) => result.status === "success"))
      throw new Error("Liquidation failed");

    // TODO: handle the asset changes to compute profit, and might use it to validate slippage

    this.encodeCallback(encoder, src, dst, srcAmount, bestFeeTier, router);
  }

  private encodeCallback(
    encoder: ExecutorEncoder,
    src: Address,
    dst: Address,
    srcAmount: bigint,
    bestFeeTier: number,
    router: Address,
  ): void {
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
