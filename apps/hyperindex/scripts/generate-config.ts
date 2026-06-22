import { getChainAddresses } from "@morpho-org/blue-sdk";
import {
  chainConfigs,
  hyperIndexChainConfigs,
} from "@morpho-blue-liquidation-bot/config";
import { stringify } from "yaml";
import { writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Sync mode is determined by the ENVIO_API_TOKEN environment variable:
 * - Set     → HyperSync (fast, hosted data service — no RPC needed)
 * - Not set → RPC (falls back to RPC_URL_<chainId> env vars)
 */
const useHyperSync = !!process.env.ENVIO_API_TOKEN;

interface ChainConfig {
  id: number;
  start_block: number;
  rpc?: { url: string; for: string };
  contracts: ContractConfig[];
}

interface ContractConfig {
  name: string;
  address?: string[];
  start_block: number;
}

function buildChainConfig(chainId: number): ChainConfig {
  const addresses = getChainAddresses(chainId);
  const blocks = hyperIndexChainConfigs[chainId]!;

  const metaMorphoFactoryAddresses = [
    addresses.metaMorphoFactory,
    ...(blocks.additionalMetaMorphoFactories ?? []),
  ];

  const chainConfig: ChainConfig = {
    id: chainId,
    start_block: 0,
    contracts: [
      {
        name: "Morpho",
        address: [addresses.morpho],
        start_block: blocks.morphoStartBlock,
      },
      {
        name: "MetaMorphoFactory",
        address: metaMorphoFactoryAddresses.filter(
          (address) => address !== undefined,
        ) as string[],
        start_block: blocks.metaMorphoFactoryStartBlock,
      },
      {
        name: "MetaMorpho",
        start_block: blocks.metaMorphoFactoryStartBlock,
      },
      {
        name: "AdaptiveCurveIRM",
        address: [addresses.adaptiveCurveIrm],
        start_block: blocks.adaptiveCurveIrmStartBlock,
      },
      {
        name: "PreLiquidationFactory",
        address: [addresses.preLiquidationFactory!],
        start_block: blocks.preLiquidationFactoryStartBlock,
      },
    ],
  };

  if (!useHyperSync) {
    const rpcUrl = process.env[`RPC_URL_${chainId}`];
    if (!rpcUrl) {
      throw new Error(
        `RPC_URL_${chainId} is required when ENVIO_API_TOKEN is not set`,
      );
    }
    chainConfig.rpc = { url: rpcUrl, for: "sync" };
  }

  return chainConfig;
}

const config = {
  name: "morpho-liquidation-bot-indexer",
  description: "Morpho Protocol Indexer for Liquidation Bot",
  contracts: [
    {
      name: "Morpho",
      abi_file_path: "./abis/MorphoBlue.json",
      handler: "./src/handlers/MorphoBlue.ts",
      events: [
        {
          event:
            "CreateMarket(bytes32 indexed id, (address, address, address, address, uint256) marketParams)",
        },
        { event: "SetFee(bytes32 indexed id, uint256 newFee)" },
        {
          event:
            "AccrueInterest(bytes32 indexed id, uint256 prevBorrowRate, uint256 interest, uint256 feeShares)",
        },
        {
          event:
            "Supply(bytes32 indexed id, address indexed caller, address indexed onBehalf, uint256 assets, uint256 shares)",
        },
        {
          event:
            "Withdraw(bytes32 indexed id, address caller, address indexed onBehalf, address indexed receiver, uint256 assets, uint256 shares)",
        },
        {
          event:
            "SupplyCollateral(bytes32 indexed id, address indexed caller, address indexed onBehalf, uint256 assets)",
        },
        {
          event:
            "WithdrawCollateral(bytes32 indexed id, address caller, address indexed onBehalf, address indexed receiver, uint256 assets)",
        },
        {
          event:
            "Borrow(bytes32 indexed id, address caller, address indexed onBehalf, address indexed receiver, uint256 assets, uint256 shares)",
        },
        {
          event:
            "Repay(bytes32 indexed id, address indexed caller, address indexed onBehalf, uint256 assets, uint256 shares)",
        },
        {
          event:
            "Liquidate(bytes32 indexed id, address indexed caller, address indexed borrower, uint256 repaidAssets, uint256 repaidShares, uint256 seizedAssets, uint256 badDebtAssets, uint256 badDebtShares)",
        },
        {
          event:
            "SetAuthorization(address indexed caller, address indexed authorizer, address indexed authorized, bool newIsAuthorized)",
        },
      ],
    },
    {
      name: "MetaMorphoFactory",
      abi_file_path: "./abis/MetaMorphoFactory.json",
      handler: "./src/handlers/MetaMorpho.ts",
      events: [
        {
          event:
            "CreateMetaMorpho(address indexed metaMorpho, address indexed caller, address initialOwner, uint256 initialTimelock, address indexed asset, string name, string symbol, bytes32 salt)",
        },
      ],
    },
    {
      name: "MetaMorpho",
      abi_file_path: "./abis/MetaMorpho.json",
      handler: "./src/handlers/MetaMorpho.ts",
      events: [
        {
          event:
            "SetWithdrawQueue(address indexed caller, bytes32[] newWithdrawQueue)",
        },
      ],
    },
    {
      name: "AdaptiveCurveIRM",
      abi_file_path: "./abis/AdaptiveCurveIrm.json",
      handler: "./src/handlers/AdaptiveCurveIrm.ts",
      events: [
        {
          event:
            "BorrowRateUpdate(bytes32 indexed id, uint256 avgBorrowRate, uint256 rateAtTarget)",
        },
      ],
    },
    {
      name: "PreLiquidationFactory",
      abi_file_path: "./abis/PreLiquidationFactory.json",
      handler: "./src/handlers/PreLiquidationFactory.ts",
      events: [
        {
          event:
            "CreatePreLiquidation(address indexed preLiquidation, bytes32 id, (uint256, uint256, uint256, uint256, uint256, address) preLiquidationParams)",
        },
      ],
    },
  ],
  chains: Object.keys(hyperIndexChainConfigs)
    .map(Number)
    .filter((chainId) => chainId in chainConfigs)
    .map(buildChainConfig),
};

const yamlContent =
  "# yaml-language-server: $schema=./node_modules/envio/evm.schema.json\n" +
  "# Auto-generated by scripts/generate-config.ts — do not edit manually.\n" +
  "# Run `pnpm generate:config` to regenerate.\n" +
  stringify(config, { lineWidth: 120 });

const outputPath = resolve(__dirname, "..", "config.yaml");
writeFileSync(outputPath, yamlContent);
console.log(
  `Generated config.yaml at ${outputPath} (sync: ${useHyperSync ? "HyperSync" : "RPC"})`,
);
