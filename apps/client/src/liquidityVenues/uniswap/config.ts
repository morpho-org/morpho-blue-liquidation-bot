import type { Address } from "viem";
import { mainnet } from "viem/chains";

export const UNISWAP_ADDRESSES: Record<
  number,
  {
    factory: Address;
    router: Address;
  }
> = {
  [mainnet.id]: {
    factory: "0x1F98431c8aD98523631AE4a59f267346ea31F984",
    router: "0xE592427A0AEce92De3Edee1F18E0157C05861564",
  },
};

export const FEE_TIERS = [500, 3000, 10000];
