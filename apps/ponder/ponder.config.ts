import { createConfig, factory } from "ponder";
import { type AbiEvent, getAbiItem, http } from "viem";

import { chainConfig } from "../config";
import { chainConfigs } from "../config/config";

import { adaptiveCurveIrmAbi } from "./abis/AdaptiveCurveIrm";
import { metaMorphoAbi } from "./abis/MetaMorpho";
import { metaMorphoFactoryAbi } from "./abis/MetaMorphoFactory";
import { morphoBlueAbi } from "./abis/MorphoBlue";

const configs = Object.values(chainConfigs).map((config) => chainConfig(config.chain.id));

const networks = Object.fromEntries(
  configs.map((config) => [
    config.chain.name,
    {
      chainId: config.chain.id,
      transport: http(config.rpcUrl),
    },
  ]),
);

export default createConfig({
  networks,
  contracts: {
    Morpho: {
      abi: morphoBlueAbi,
      network: Object.fromEntries(
        configs.map((config) => [
          config.chain.name,
          {
            address: config.morpho.address,
            startBlock: config.morpho.startBlock,
          },
        ]),
      ) as Record<
        keyof typeof networks,
        {
          readonly address: `0x${string}`;
          readonly startBlock: number;
        }
      >,
    },
    MetaMorpho: {
      abi: metaMorphoAbi,
      network: Object.fromEntries(
        configs.map((config) => [
          config.chain.name,
          {
            address: factory({
              address: config.metaMorphoFactories.addresses,
              event: getAbiItem({ abi: metaMorphoFactoryAbi, name: "CreateMetaMorpho" }),
              parameter: "metaMorpho",
            }),
            startBlock: config.metaMorphoFactories.startBlock,
          },
        ]),
      ) as Record<
        keyof typeof networks,
        {
          readonly address: Factory<
            Extract<
              (typeof metaMorphoFactoryAbi)[number],
              { type: "event"; name: "CreateMetaMorpho" }
            >
          >;
          readonly startBlock: number;
        }
      >,
    },
    AdaptiveCurveIRM: {
      abi: adaptiveCurveIrmAbi,
      network: Object.fromEntries(
        configs.map((config) => [
          config.chain.name,
          {
            address: config.adaptiveCurveIrm.address,
            startBlock: config.adaptiveCurveIrm.startBlock,
          },
        ]),
      ) as Record<
        keyof typeof networks,
        {
          readonly address: `0x${string}`;
          readonly startBlock: number;
        }
      >,
    },
  },
});

interface Factory<event extends AbiEvent = AbiEvent> {
  address: `0x${string}` | readonly `0x${string}`[];
  event: event;
  parameter: Exclude<event["inputs"][number]["name"], undefined>;
}
