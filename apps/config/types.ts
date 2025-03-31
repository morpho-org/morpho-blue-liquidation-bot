import type { Address, Chain, Hex } from "viem";

export type ChainConfig = Config & {
  ponderRpcUrl: string;
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

export interface EnvVariables {
  ponderRpcUrl: string | undefined;
  rpcUrl?: string | undefined;
  executorAddress: string | undefined;
  liquidationPrivateKey: string | undefined;
}
