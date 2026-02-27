export const preLiquidationFactoryAbi = [
    {
      inputs: [{ internalType: "address", name: "morpho", type: "address" }],
      stateMutability: "nonpayable",
      type: "constructor",
    },
    { inputs: [], name: "ZeroAddress", type: "error" },
    {
      anonymous: false,
      inputs: [
        { indexed: true, internalType: "address", name: "preLiquidation", type: "address" },
        { indexed: false, internalType: "Id", name: "id", type: "bytes32" },
        {
          components: [
            { internalType: "uint256", name: "preLltv", type: "uint256" },
            { internalType: "uint256", name: "preLCF1", type: "uint256" },
            { internalType: "uint256", name: "preLCF2", type: "uint256" },
            { internalType: "uint256", name: "preLIF1", type: "uint256" },
            { internalType: "uint256", name: "preLIF2", type: "uint256" },
            { internalType: "address", name: "preLiquidationOracle", type: "address" },
          ],
          indexed: false,
          internalType: "struct PreLiquidationParams",
          name: "preLiquidationParams",
          type: "tuple",
        },
      ],
      name: "CreatePreLiquidation",
      type: "event",
    },
    {
      inputs: [],
      name: "MORPHO",
      outputs: [{ internalType: "contract IMorpho", name: "", type: "address" }],
      stateMutability: "view",
      type: "function",
    },
    {
      inputs: [
        { internalType: "Id", name: "id", type: "bytes32" },
        {
          components: [
            { internalType: "uint256", name: "preLltv", type: "uint256" },
            { internalType: "uint256", name: "preLCF1", type: "uint256" },
            { internalType: "uint256", name: "preLCF2", type: "uint256" },
            { internalType: "uint256", name: "preLIF1", type: "uint256" },
            { internalType: "uint256", name: "preLIF2", type: "uint256" },
            { internalType: "address", name: "preLiquidationOracle", type: "address" },
          ],
          internalType: "struct PreLiquidationParams",
          name: "preLiquidationParams",
          type: "tuple",
        },
      ],
      name: "createPreLiquidation",
      outputs: [{ internalType: "contract IPreLiquidation", name: "", type: "address" }],
      stateMutability: "nonpayable",
      type: "function",
    },
    {
      inputs: [{ internalType: "address", name: "", type: "address" }],
      name: "isPreLiquidation",
      outputs: [{ internalType: "bool", name: "", type: "bool" }],
      stateMutability: "view",
      type: "function",
    },
  ] as const;
  