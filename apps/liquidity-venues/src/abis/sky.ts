export const daiUsdsConverterAbi = [
  {
    inputs: [
      { internalType: "address", name: "usr", type: "address" },
      { internalType: "uint256", name: "wad", type: "uint256" },
    ],
    name: "daiToUsds",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { internalType: "address", name: "usr", type: "address" },
      { internalType: "uint256", name: "wad", type: "uint256" },
    ],
    name: "usdsToDai",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
] as const;

export const mkrSkyConverterAbi = [
  {
    inputs: [
      { internalType: "address", name: "usr", type: "address" },
      { internalType: "uint256", name: "mkrAmt", type: "uint256" },
    ],
    name: "mkrToSky",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { internalType: "address", name: "usr", type: "address" },
      { internalType: "uint256", name: "skyAmt", type: "uint256" },
    ],
    name: "skyToMkr",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [],
    name: "rate",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
] as const;
