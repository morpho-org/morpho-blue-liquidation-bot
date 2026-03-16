import { getChainAddresses } from "@morpho-org/blue-sdk";
import { hyperIndexChainConfigs } from "@morpho-blue-liquidation-bot/config";
import { stringify } from "yaml";
import { writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Test config: index only mainnet (chain 1) with a fixed end block.
 * This allows deterministic testing by comparing indexed state to on-chain reads
 * at the same block number.
 *
 * Always uses RPC sync (not HyperSync) via RPC_URL_1.
 */
const END_BLOCK = 19_200_000;

const addresses = getChainAddresses(1);
const blocks = hyperIndexChainConfigs[1]!;

const config = {
  name: "morpho-liquidation-bot-indexer-test",
  description: "Morpho Protocol Indexer — Test Config (mainnet only, fixed block range)",
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
  chains: [
    {
      id: 1,
      start_block: 0,
      end_block: END_BLOCK,
      rpc: {
        url: process.env.RPC_URL_1,
        for: "sync",
      },
      contracts: [
        {
          name: "Morpho",
          address: [addresses.morpho],
          start_block: blocks.morphoStartBlock,
        },
        {
          name: "MetaMorphoFactory",
          address: [
            addresses.metaMorphoFactory,
            ...(blocks.additionalMetaMorphoFactories ?? []),
          ].filter(Boolean),
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
    },
  ],
};

const yamlContent =
  "# yaml-language-server: $schema=./node_modules/envio/evm.schema.json\n" +
  "# Auto-generated test config — do not edit manually.\n" +
  `# Indexes mainnet only, blocks ${blocks.morphoStartBlock.toLocaleString()} → ${END_BLOCK.toLocaleString()}.\n` +
  stringify(config, { lineWidth: 120 });

const outputPath = resolve(__dirname, "..", "config.test.yaml");
writeFileSync(outputPath, yamlContent);
console.log(`Generated test config at ${outputPath}`);
