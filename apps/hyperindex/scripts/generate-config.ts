import { getChainAddresses } from "@morpho-org/blue-sdk";
import { stringify } from "yaml";
import { writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Start blocks for each contract on each chain.
 * These are the deployment blocks — `getChainAddresses` doesn't provide them.
 *
 * Source: https://github.com/moose-code/morpho-indexer/blob/main/config.yaml
 */
const startBlocks: Record<
  number,
  {
    morpho: number;
    metaMorphoFactory: number;
    adaptiveCurveIrm: number;
    preLiquidationFactory: number;
  }
> = {
  1: {
    morpho: 18883124,
    metaMorphoFactory: 18925584,
    adaptiveCurveIrm: 18883124,
    preLiquidationFactory: 21414664,
  },
  8453: {
    morpho: 13977148,
    metaMorphoFactory: 13978134,
    adaptiveCurveIrm: 13977152,
    preLiquidationFactory: 23779056,
  },
  130: {
    morpho: 9139027,
    metaMorphoFactory: 9316789,
    adaptiveCurveIrm: 9139027,
    preLiquidationFactory: 9381237,
  },
  42161: {
    morpho: 296446593,
    metaMorphoFactory: 296447195,
    adaptiveCurveIrm: 296446593,
    preLiquidationFactory: 307326238,
  },
  480: {
    morpho: 9025669,
    metaMorphoFactory: 9025733,
    adaptiveCurveIrm: 9025669,
    preLiquidationFactory: 10273494,
  },
  143: {
    morpho: 31907457,
    metaMorphoFactory: 32320327,
    adaptiveCurveIrm: 31907457,
    preLiquidationFactory: 32321504,
  },
};

/**
 * Additional factory addresses per chain (e.g. vaultV2Factory) that are not
 * the primary metaMorphoFactory but also emit CreateMetaMorpho events.
 */
const additionalMetaMorphoFactories: Record<number, string[]> = {
  1: ["0xA9c3D3a366466Fa809d1Ae982Fb2c46E5fC41101"],
  8453: ["0xA9c3D3a366466Fa809d1Ae982Fb2c46E5fC41101"],
};

// Chain IDs supported by both our config and HyperSync
const supportedChainIds = [1, 8453, 130, 42161, 480, 143];

interface ChainConfig {
  id: number;
  start_block: number;
  contracts: ContractConfig[];
}

interface ContractConfig {
  name: string;
  address?: string[];
  start_block: number;
}

function buildChainConfig(chainId: number): ChainConfig {
  const addresses = getChainAddresses(chainId);
  const blocks = startBlocks[chainId]!;

  const metaMorphoFactoryAddresses = [
    addresses.metaMorphoFactory,
    ...(additionalMetaMorphoFactories[chainId] ?? []),
  ];

  return {
    id: chainId,
    start_block: 0,
    contracts: [
      {
        name: "Morpho",
        address: [addresses.morpho],
        start_block: blocks.morpho,
      },
      {
        name: "MetaMorphoFactory",
        address: metaMorphoFactoryAddresses.filter((address) => address !== undefined) as string[],
        start_block: blocks.metaMorphoFactory,
      },
      {
        name: "MetaMorpho",
        start_block: blocks.metaMorphoFactory,
      },
      {
        name: "AdaptiveCurveIRM",
        address: [addresses.adaptiveCurveIrm],
        start_block: blocks.adaptiveCurveIrm,
      },
      {
        name: "PreLiquidationFactory",
        address: [addresses.preLiquidationFactory!],
        start_block: blocks.preLiquidationFactory,
      },
    ],
  };
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
          event: "SetWithdrawQueue(address indexed caller, bytes32[] newWithdrawQueue)",
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
  chains: supportedChainIds.map(buildChainConfig),
};

const yamlContent =
  "# yaml-language-server: $schema=./node_modules/envio/evm.schema.json\n" +
  "# Auto-generated by scripts/generate-config.ts — do not edit manually.\n" +
  "# Run `pnpm generate:config` to regenerate.\n" +
  stringify(config, { lineWidth: 120 });

const outputPath = resolve(__dirname, "..", "config.yaml");
writeFileSync(outputPath, yamlContent);
console.log(`Generated config.yaml at ${outputPath}`);
