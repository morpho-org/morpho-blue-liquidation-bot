import { chainConfig, chainConfigs } from "@morpho-blue-liquidation-bot/config";
import { createConfig, factory } from "ponder";
import { type AbiEvent, getAbiItem } from "viem";

import { adaptiveCurveIrmAbi } from "./abis/AdaptiveCurveIrm";
import { metaMorphoAbi } from "./abis/MetaMorpho";
import { metaMorphoFactoryAbi } from "./abis/MetaMorphoFactory";
import { morphoBlueAbi } from "./abis/MorphoBlue";
import { preLiquidationFactoryAbi } from "./abis/PreLiquidationFactory";

const configs = Object.values(chainConfigs).map((config) => chainConfig(config.chain.id));

const chains = Object.fromEntries(
  configs.map((config) => [
    config.chain.name,
    {
      id: config.chain.id,
      rpc: config.rpcUrl,
    },
  ]),
);

export default createConfig({
  ordering: "multichain",
  chains,
  contracts: {
    Morpho: {
      abi: morphoBlueAbi,
      chain: Object.fromEntries(
        configs.map((config) => [
          config.chain.name,
          {
            address: config.morpho.address,
            startBlock: config.morpho.startBlock,
          },
        ]),
      ) as Record<
        keyof typeof chains,
        {
          readonly address: `0x${string}`;
          readonly startBlock: number;
        }
      >,
    },
    MetaMorpho: {
      abi: metaMorphoAbi,
      chain: Object.fromEntries(
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
        keyof typeof chains,
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
      chain: Object.fromEntries(
        configs.map((config) => [
          config.chain.name,
          {
            address: config.adaptiveCurveIrm.address,
            startBlock: config.adaptiveCurveIrm.startBlock,
          },
        ]),
      ) as Record<
        keyof typeof chains,
        {
          readonly address: `0x${string}`;
          readonly startBlock: number;
        }
      >,
    },
    PreLiquidationFactory: {
      abi: preLiquidationFactoryAbi,
      chain: Object.fromEntries(
        configs.map((config) => [
          config.chain.name,
          {
            address: config.preLiquidationFactory.address,
            startBlock: config.preLiquidationFactory.startBlock,
          },
        ]),
      ) as Record<
        keyof typeof chains,
        {
          readonly address: `0x${string}`;
          readonly startBlock: number;
        }
      >,
    },
  },
  database: {
    kind: "postgres",
    connectionString:
      process.env.POSTGRES_DATABASE_URL ?? "postgres://ponder:ponder@localhost:5432/ponder",
  },
});

interface Factory<event extends AbiEvent = AbiEvent> {
  address: `0x${string}` | readonly `0x${string}`[];
  event: event;
  parameter: Exclude<event["inputs"][number]["name"], undefined>;
}
