import { createConfig, factory } from "ponder";
import { getAbiItem, http } from "viem";
import { base, mainnet } from "viem/chains";
import { chainConfig } from "../config";

import { adaptiveCurveIrmAbi } from "./abis/AdaptiveCurveIrm";
import { metaMorphoAbi } from "./abis/MetaMorpho";
import { metaMorphoFactoryAbi } from "./abis/MetaMorphoFactory";
import { morphoBlueAbi } from "./abis/MorphoBlue";

const mainnetConfig = chainConfig(mainnet.id);
const baseConfig = chainConfig(base.id);

export default createConfig({
  networks: {
    mainnet: { chainId: mainnet.id, transport: http(mainnetConfig.rpcUrl) },
    base: { chainId: base.id, transport: http(baseConfig.rpcUrl) },
  },
  contracts: {
    Morpho: {
      abi: morphoBlueAbi,
      network: {
        mainnet: {
          address: mainnetConfig.morpho.address,
          startBlock: mainnetConfig.morpho.startBlock,
        },
        base: {
          address: baseConfig.morpho.address,
          startBlock: baseConfig.morpho.startBlock,
        },
      },
    },
    MetaMorpho: {
      abi: metaMorphoAbi,
      network: {
        mainnet: {
          address: factory({
            address: mainnetConfig.metaMorphoFactories.addresses,
            event: getAbiItem({ abi: metaMorphoFactoryAbi, name: "CreateMetaMorpho" }),
            parameter: "metaMorpho",
          }),
          startBlock: mainnetConfig.metaMorphoFactories.startBlock,
        },
        base: {
          address: factory({
            address: baseConfig.metaMorphoFactories.addresses,
            event: getAbiItem({ abi: metaMorphoFactoryAbi, name: "CreateMetaMorpho" }),
            parameter: "metaMorpho",
          }),
          startBlock: baseConfig.metaMorphoFactories.startBlock,
        },
      },
    },
    AdaptiveCurveIRM: {
      abi: adaptiveCurveIrmAbi,
      network: {
        mainnet: {
          address: mainnetConfig.adaptiveCurveIrm.address,
          startBlock: mainnetConfig.adaptiveCurveIrm.startBlock,
        },
        base: {
          address: baseConfig.adaptiveCurveIrm.address,
          startBlock: baseConfig.adaptiveCurveIrm.startBlock,
        },
      },
    },
  },
});
