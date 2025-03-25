import type { ExecutorEncoder } from "executooor-viem";
import { zeroAddress, type Address } from "viem";

import type { ToConvert } from "../../utils/types";
import type { LiquidityVenue } from "../liquidityVenue";

import { wrappers } from "./config";

export class Erc20Wrapper implements LiquidityVenue {
  private underlying: Record<Address, Address> = {};

  supportsRoute(encoder: ExecutorEncoder, src: Address, dst: Address) {
    if (src === dst) return false;
    if (this.underlying[src] !== undefined) {
      return this.underlying[src] !== zeroAddress;
    }

    const underlying = this.getUnderlying(src, encoder.client.chain.id);
    this.underlying[src] = underlying ?? zeroAddress;
    return this.underlying[src] !== zeroAddress;
  }

  convert(encoder: ExecutorEncoder, toConvert: ToConvert) {
    const { src, dst, srcAmount } = toConvert;

    const underlying = this.underlying[src];

    if (underlying === undefined) {
      return toConvert;
    }

    encoder.erc20WrapperWithdrawTo(src, encoder.address, srcAmount);

    return { src: underlying, dst, srcAmount };
  }

  private getUnderlying(src: Address, chainId: number) {
    return wrappers[chainId]?.[src];
  }
}
