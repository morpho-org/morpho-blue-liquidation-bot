import type { Address, Chain, Hex } from "viem";

export type ChainConfig = Config & {
  chainId: number;
  rpcUrl: string;
  executorAddress: Address;
  liquidationPrivateKey: Hex;
};

export interface Config {
  chain: Chain;
  morpho: {
    address: Address;
    startBlock: number;
  };
  adaptiveCurveIrm: {
    address: Address;
    startBlock: number;
  };
  metaMorphoFactories: {
    addresses: Address[];
    startBlock: number;
  };
  vaultWhitelist: Address[];
  additionalMarketsWhitelist: Hex[];
}
