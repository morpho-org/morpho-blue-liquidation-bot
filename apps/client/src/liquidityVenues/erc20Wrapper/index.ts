import type { ExecutorEncoder } from "executooor-viem";
import { zeroAddress, type Address } from "viem";

import type { ToConvert } from "../../utils/types";
import type { LiquidityVenue } from "../liquidityVenue";

import { wrappers } from "./config";

export class Erc20Wrapper implements LiquidityVenue {
  private underlying: Address = zeroAddress;

  supportsRoute(encoder: ExecutorEncoder, src: Address, dst: Address) {
    if (src === dst) return false;
    const underlying = this.getUnderlying(src, encoder.client.chain.id);
    if (underlying !== undefined) {
      this.underlying = underlying;
      return true;
    }

    return false;
  }

  convert(encoder: ExecutorEncoder, toConvert: ToConvert) {
    const { src, dst, srcAmount } = toConvert;

    encoder.erc20WrapperWithdrawTo(src, encoder.address, srcAmount);

    return { src: this.underlying, dst, srcAmount };
  }

  private getUnderlying(src: Address, chainId: number) {
    return wrappers[chainId]?.[src];
  }
}
