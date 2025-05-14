import { createConfig, factory } from "ponder";
import { getAbiItem, http } from "viem";
import { mainnet } from "viem/chains";

import { adaptiveCurveIrmAbi } from "../abis/AdaptiveCurveIrm";
import { metaMorphoAbi } from "../abis/MetaMorpho";
import { metaMorphoFactoryAbi } from "../abis/MetaMorphoFactory";
import { morphoBlueAbi } from "../abis/MorphoBlue";
import { preLiquidationFactoryAbi } from "../abis/PreLiquidationFactory";

export default createConfig({
  networks: {
    mainnet: {
      chainId: 1,
      transport: http(process.env.RPC_URL_1 ?? mainnet.rpcUrls.default.http[0]),
    },
  },
  contracts: {
    Morpho: {
      abi: morphoBlueAbi,
      network: {
        mainnet: {
          address: "0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb",
          startBlock: 18883124,
          endBlock: 19200000,
        },
      },
    },
    MetaMorpho: {
      abi: metaMorphoAbi,
      network: {
        mainnet: {
          address: factory({
            address: ["0xA9c3D3a366466Fa809d1Ae982Fb2c46E5fC41101"],
            event: getAbiItem({ abi: metaMorphoFactoryAbi, name: "CreateMetaMorpho" }),
            parameter: "metaMorpho",
          }),
          startBlock: 18925584,
          endBlock: 19200000,
        },
      },
    },
    AdaptiveCurveIRM: {
      abi: adaptiveCurveIrmAbi,
      network: {
        mainnet: {
          address: "0x870aC11D48B15DB9a138Cf899d20F13F79Ba00BC",
          startBlock: 18883124,
          endBlock: 19200000,
        },
      },
    },
    PreLiquidationFactory: {
      abi: preLiquidationFactoryAbi,
      network: {
        mainnet: {
          address: "0x6FF33615e792E35ed1026ea7cACCf42D9BF83476",
          startBlock: 18883124,
          endBlock: 19200000,
        },
      },
    },
  },
});
