import type { ExecutorEncoder } from "executooor-viem";
import { erc4626Abi, zeroAddress, type Address } from "viem";
import { readContract } from "viem/actions";

import type { ToConvert } from "../../utils";
import type { LiquidityVenue } from "../liquidityVenue";

export class Erc4626 implements LiquidityVenue {
  private underlying: Address = zeroAddress;

  async supportsRoute(encoder: ExecutorEncoder, src: Address, dst: Address) {
    if (src === dst) return false;
    try {
      const underlying = await readContract(encoder.client, {
        address: src,
        abi: erc4626Abi,
        functionName: "asset",
      });
      if (underlying === zeroAddress) return false;
      this.underlying = underlying;
      return true;
    } catch (error) {
      console.error(error);
      return false;
    }
  }

  async convert(encoder: ExecutorEncoder, toConvert: ToConvert) {
    const { src, dst, srcAmount } = toConvert;

    try {
      const withdrawAmount = await readContract(encoder.client, {
        address: src,
        abi: erc4626Abi,
        functionName: "previewRedeem",
        args: [srcAmount],
      });
      if (withdrawAmount === 0n) return toConvert;

      encoder.erc4626Redeem(src, srcAmount, encoder.address, encoder.address);
      return { src: this.underlying, dst, srcAmount: withdrawAmount };
    } catch (error) {
      console.error(error);
      return toConvert;
    }
  }
}
