import type { Address } from "viem";

export const UNISWAP_ADDRESSES: Record<
  number,
  {
    factory: Address;
    router: Address;
  }
> = {
  1: {
    factory: "0x1F98431c8aD98523631AE4a59f267346ea31F984",
    router: "0xE592427A0AEce92De3Edee1F18E0157C05861564",
  },
};

export const FEE_TIERS = [500, 3000, 10000];
