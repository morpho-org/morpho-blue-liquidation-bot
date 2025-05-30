import { CommandType, RoutePlanner } from "@uniswap/universal-router-sdk";
import { Actions, PoolKey, V4Planner } from "@uniswap/v4-sdk";
import { type ExecutorEncoder } from "executooor-viem";
import {
  type Address,
  encodeFunctionData,
  erc20Abi,
  Hex,
  maxUint256,
  maxUint48,
  ValueOf,
  zeroAddress,
} from "viem";
import { getContractEvents, multicall, readContract } from "viem/actions";
import { mainnet, unichain } from "viem/chains";

import { permit2Abi } from "../../abis/permit2";
import {
  uniswapUniversalRouterAbi,
  uniswapV4PoolManagerAbi,
  uniswapV4StateViewAbi,
} from "../../abis/uniswapV4";
import type { ToConvert } from "../../utils/types";
import type { LiquidityVenue } from "../liquidityVenue";

type Contracts = "PoolManager" | "Quoter" | "StateView" | "UniversalRouter" | "Permit2" | "WETH";

const DEPLOYMENTS: Record<number, Record<Contracts, { address: Address; fromBlock: bigint }>> = {
  [mainnet.id]: {
    PoolManager: { address: "0x000000000004444c5dc75cB358380D2e3dE08A90", fromBlock: 21688329n },
    Quoter: { address: "0x52F0E24D1c21C8A0cB1e5a5dD6198556BD9E1203", fromBlock: 21689090n },
    StateView: { address: "0x7fFE42C4a5DEeA5b0feC41C94C136Cf115597227", fromBlock: 21689091n },
    UniversalRouter: {
      address: "0x66a9893cC07D91D95644AEDD05D03f95e1dBA8Af",
      fromBlock: 21689092n,
    },
    Permit2: { address: "0x000000000022D473030F116dDEE9F6B43aC78BA3", fromBlock: 15986406n },
    WETH: { address: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", fromBlock: 4719568n },
  },
  [unichain.id]: {
    PoolManager: { address: "0x1f98400000000000000000000000000000000004", fromBlock: 0n },
    Quoter: { address: "0x333e3c607b141b18ff6de9f258db6e77fe7491e0", fromBlock: 6819683n },
    StateView: { address: "0x86e8631a016f9068c3f085faf484ee3f5fdee8f2", fromBlock: 6819686n },
    UniversalRouter: { address: "0xef740bf23acae26f6492b10de645d6b98dc8eaf3", fromBlock: 6819690n },
    Permit2: { address: "0x000000000022D473030F116dDEE9F6B43aC78BA3", fromBlock: 0n },
    WETH: { address: "0x4200000000000000000000000000000000000006", fromBlock: 0n },
  },
};

export class UniswapV4Venue implements LiquidityVenue {
  supportsRoute(
    encoder: ExecutorEncoder,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    src: Address,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    dst: Address,
  ): Promise<boolean> | boolean {
    return DEPLOYMENTS[encoder.client.chain.id] !== undefined;
  }

  async convert(encoder: ExecutorEncoder, toConvert: ToConvert) {
    const { src: rawSrc, dst: rawDst, srcAmount } = toConvert;

    const deployments = DEPLOYMENTS[encoder.client.chain.id];
    if (!deployments) return toConvert;
    const { PoolManager, StateView, UniversalRouter, WETH } = deployments;

    // Uniswap v4 operates on ETH natively
    const shouldUnwrap = rawSrc === WETH.address;
    const shouldWrap = rawDst === WETH.address;
    const src = shouldUnwrap ? zeroAddress : rawSrc;
    const dst = shouldWrap ? zeroAddress : rawDst;

    const { currency0, currency1, pools } = await this.fetchPools(encoder, PoolManager, src, dst);
    if (pools.length === 0) return toConvert;

    const liquidities = await multicall(encoder.client, {
      contracts: pools.map((pool) => ({
        ...StateView,
        abi: uniswapV4StateViewAbi,
        functionName: "getLiquidity" as const,
        args: [pool.id],
      })),
      allowFailure: true,
      batchSize: 2 ** 16,
    });

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    let bestPool = pools[0]!;
    let bestLiquidity = 0n;
    for (let i = 0; i < pools.length; i += 1) {
      const liquidity = liquidities[i];
      if (!liquidity || liquidity.status === "failure") continue;
      if (liquidity.result > bestLiquidity) {
        // TODO: could improve this by picking minimum fee tier if there's a set
        // of similarly-sized pools.
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        bestPool = pools[i]!;
        bestLiquidity = liquidity.result;
      }
    }

    const bestPoolKey: PoolKey = {
      currency0,
      currency1,
      fee: bestPool.fee,
      tickSpacing: bestPool.tickSpacing,
      hooks: bestPool.hooks,
    };

    // Configure exact swap at the Uniswap v4 Router level
    const v4Planner = new V4Planner();
    v4Planner.addAction(Actions.SWAP_EXACT_IN_SINGLE, [
      // See https://github.com/Uniswap/sdks/blob/5a1cbfb55d47625afd40f5f0f5e934ed18dfd5e4/sdks/v4-sdk/src/utils/v4Planner.ts#L70
      {
        poolKey: bestPoolKey,
        zeroForOne: currency0 === src,
        amountIn: srcAmount,
        amountOutMinimum: 0n,
        hookData: "0x",
      },
    ]);
    v4Planner.addAction(Actions.SETTLE_ALL, [src, maxUint256]); // [currency, maxAmount]
    v4Planner.addAction(Actions.TAKE_ALL, [dst, 0n]); // [currency, minAmount]

    // Configure overall actions at the Uniswap Universal Router level
    const routePlanner = new RoutePlanner();
    if (shouldUnwrap) {
      routePlanner.addCommand(CommandType.PERMIT2_TRANSFER_FROM, [
        WETH.address,
        UniversalRouter.address,
        srcAmount,
      ]);
      routePlanner.addCommand(CommandType.UNWRAP_WETH, [UniversalRouter.address, 0], false);
    }
    // See https://github.com/Uniswap/sdks/blob/5a1cbfb55d47625afd40f5f0f5e934ed18dfd5e4/sdks/universal-router-sdk/src/utils/routerCommands.ts#L268
    routePlanner.addCommand(CommandType.V4_SWAP, [v4Planner.finalize()], false);

    // Make sure Permit2 can control our tokens
    const permit2Allowance = await readContract(encoder.client, {
      abi: erc20Abi,
      address: rawSrc,
      functionName: "allowance",
      args: [encoder.address, deployments.Permit2.address],
    });
    if (permit2Allowance < srcAmount) {
      encoder.erc20Approve(rawSrc, deployments.Permit2.address, maxUint256);
    }

    // Tell Permit2 that the UniversalRouter can spend our tokens
    const deadline = maxUint48;
    encoder.pushCall(
      deployments.Permit2.address,
      0n,
      encodeFunctionData({
        abi: permit2Abi,
        functionName: "approve",
        args: [rawSrc, deployments.UniversalRouter.address, srcAmount, Number(deadline)],
      }),
    );

    encoder.pushCall(
      UniversalRouter.address,
      0n,
      encodeFunctionData({
        abi: uniswapUniversalRouterAbi,
        functionName: "execute",
        args: [routePlanner.commands as Hex, routePlanner.inputs as Hex[], deadline],
      }),
    );
    if (shouldWrap) {
      // `Executor` contract caps amount at `address(this).balance`, and WETH receive
      // function falls back to a deposit -- this is the only way to wrap max amount
      // since placeholders can't specify msg.value.
      encoder.transfer(WETH.address, maxUint256);
    }

    return { ...toConvert, srcAmount: 0n };
  }

  private async fetchPools(
    encoder: ExecutorEncoder,
    poolManager: ValueOf<ValueOf<typeof DEPLOYMENTS>>,
    src: Address,
    dst: Address,
  ) {
    // Each pool's currencies are always sorted numerically.
    const [currency0, currency1] = BigInt(src) < BigInt(dst) ? [src, dst] : [dst, src];

    const poolCreationEvents = await getContractEvents(encoder.client, {
      ...poolManager,
      abi: uniswapV4PoolManagerAbi,
      eventName: "Initialize",
      args: { currency0, currency1 },
      strict: true,
    });

    // Ignore pools with hooks, as we don't know what extra data they'd require for swaps.
    const pools = poolCreationEvents
      .filter((ev) => ev.args.hooks === zeroAddress)
      .map((ev) => ev.args);

    return { currency0, currency1, pools };
  }
}
