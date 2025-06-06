import type { Address, Chain, Hex } from "viem";

export type ChainConfig = Config & {
  chainId: number;
  rpcUrl: string;
  vaultWhitelist: Address[];
  additionalMarketsWhitelist: Hex[];
  executorAddress: Address;
  liquidationPrivateKey: Hex;
  checkProfit: boolean;
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
  preLiquidationFactory: {
    address: Address;
    startBlock: number;
  };
  wNative: Address;
  options: Options;
}

export interface Options {
  vaultWhitelist: Address[];
  additionalMarketsWhitelist: Hex[];
  checkProfit: boolean;
}
