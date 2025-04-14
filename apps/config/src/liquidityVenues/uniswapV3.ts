import type { Address } from "viem";

export const DEFAULT_FACTORY_ADDRESS = "0x1F98431c8aD98523631AE4a59f267346ea31F984" as Address;
export const DEFAULT_ROUTER_ADDRESS = "0xE592427A0AEce92De3Edee1F18E0157C05861564" as Address;

export const specificAddresses: Record<
  number,
  {
    factory: Address;
    router: Address;
  }
> = {};

export const FEE_TIERS = [500, 3000, 10000];
