export const feedRegistryAbi = [
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: "address", name: "accessController", type: "address" },
      { indexed: true, internalType: "address", name: "sender", type: "address" },
    ],
    name: "AccessControllerSet",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: "address", name: "asset", type: "address" },
      { indexed: true, internalType: "address", name: "denomination", type: "address" },
      { indexed: true, internalType: "address", name: "latestAggregator", type: "address" },
      { indexed: false, internalType: "address", name: "previousAggregator", type: "address" },
      { indexed: false, internalType: "uint16", name: "nextPhaseId", type: "uint16" },
      { indexed: false, internalType: "address", name: "sender", type: "address" },
    ],
    name: "FeedConfirmed",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: "address", name: "asset", type: "address" },
      { indexed: true, internalType: "address", name: "denomination", type: "address" },
      { indexed: true, internalType: "address", name: "proposedAggregator", type: "address" },
      { indexed: false, internalType: "address", name: "currentAggregator", type: "address" },
      { indexed: false, internalType: "address", name: "sender", type: "address" },
    ],
    name: "FeedProposed",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: "address", name: "from", type: "address" },
      { indexed: true, internalType: "address", name: "to", type: "address" },
    ],
    name: "OwnershipTransferRequested",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: "address", name: "from", type: "address" },
      { indexed: true, internalType: "address", name: "to", type: "address" },
    ],
    name: "OwnershipTransferred",
    type: "event",
  },
  {
    inputs: [],
    name: "acceptOwnership",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { internalType: "address", name: "base", type: "address" },
      { internalType: "address", name: "quote", type: "address" },
      { internalType: "address", name: "aggregator", type: "address" },
    ],
    name: "confirmFeed",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { internalType: "address", name: "base", type: "address" },
      { internalType: "address", name: "quote", type: "address" },
    ],
    name: "decimals",
    outputs: [{ internalType: "uint8", name: "", type: "uint8" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { internalType: "address", name: "base", type: "address" },
      { internalType: "address", name: "quote", type: "address" },
    ],
    name: "description",
    outputs: [{ internalType: "string", name: "", type: "string" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "getAccessController",
    outputs: [{ internalType: "contract AccessControllerInterface", name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { internalType: "address", name: "base", type: "address" },
      { internalType: "address", name: "quote", type: "address" },
      { internalType: "uint256", name: "roundId", type: "uint256" },
    ],
    name: "getAnswer",
    outputs: [{ internalType: "int256", name: "answer", type: "int256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { internalType: "address", name: "base", type: "address" },
      { internalType: "address", name: "quote", type: "address" },
    ],
    name: "getCurrentPhaseId",
    outputs: [{ internalType: "uint16", name: "currentPhaseId", type: "uint16" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { internalType: "address", name: "base", type: "address" },
      { internalType: "address", name: "quote", type: "address" },
    ],
    name: "getFeed",
    outputs: [
      { internalType: "contract AggregatorV2V3Interface", name: "aggregator", type: "address" },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { internalType: "address", name: "base", type: "address" },
      { internalType: "address", name: "quote", type: "address" },
      { internalType: "uint80", name: "roundId", type: "uint80" },
    ],
    name: "getNextRoundId",
    outputs: [{ internalType: "uint80", name: "nextRoundId", type: "uint80" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { internalType: "address", name: "base", type: "address" },
      { internalType: "address", name: "quote", type: "address" },
      { internalType: "uint16", name: "phaseId", type: "uint16" },
    ],
    name: "getPhase",
    outputs: [
      {
        components: [
          { internalType: "uint16", name: "phaseId", type: "uint16" },
          { internalType: "uint80", name: "startingAggregatorRoundId", type: "uint80" },
          { internalType: "uint80", name: "endingAggregatorRoundId", type: "uint80" },
        ],
        internalType: "struct FeedRegistryInterface.Phase",
        name: "phase",
        type: "tuple",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { internalType: "address", name: "base", type: "address" },
      { internalType: "address", name: "quote", type: "address" },
      { internalType: "uint16", name: "phaseId", type: "uint16" },
    ],
    name: "getPhaseFeed",
    outputs: [
      { internalType: "contract AggregatorV2V3Interface", name: "aggregator", type: "address" },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { internalType: "address", name: "base", type: "address" },
      { internalType: "address", name: "quote", type: "address" },
      { internalType: "uint16", name: "phaseId", type: "uint16" },
    ],
    name: "getPhaseRange",
    outputs: [
      { internalType: "uint80", name: "startingRoundId", type: "uint80" },
      { internalType: "uint80", name: "endingRoundId", type: "uint80" },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { internalType: "address", name: "base", type: "address" },
      { internalType: "address", name: "quote", type: "address" },
      { internalType: "uint80", name: "roundId", type: "uint80" },
    ],
    name: "getPreviousRoundId",
    outputs: [{ internalType: "uint80", name: "previousRoundId", type: "uint80" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { internalType: "address", name: "base", type: "address" },
      { internalType: "address", name: "quote", type: "address" },
    ],
    name: "getProposedFeed",
    outputs: [
      {
        internalType: "contract AggregatorV2V3Interface",
        name: "proposedAggregator",
        type: "address",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { internalType: "address", name: "base", type: "address" },
      { internalType: "address", name: "quote", type: "address" },
      { internalType: "uint80", name: "_roundId", type: "uint80" },
    ],
    name: "getRoundData",
    outputs: [
      { internalType: "uint80", name: "roundId", type: "uint80" },
      { internalType: "int256", name: "answer", type: "int256" },
      { internalType: "uint256", name: "startedAt", type: "uint256" },
      { internalType: "uint256", name: "updatedAt", type: "uint256" },
      { internalType: "uint80", name: "answeredInRound", type: "uint80" },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { internalType: "address", name: "base", type: "address" },
      { internalType: "address", name: "quote", type: "address" },
      { internalType: "uint80", name: "roundId", type: "uint80" },
    ],
    name: "getRoundFeed",
    outputs: [
      { internalType: "contract AggregatorV2V3Interface", name: "aggregator", type: "address" },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { internalType: "address", name: "base", type: "address" },
      { internalType: "address", name: "quote", type: "address" },
      { internalType: "uint256", name: "roundId", type: "uint256" },
    ],
    name: "getTimestamp",
    outputs: [{ internalType: "uint256", name: "timestamp", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "address", name: "aggregator", type: "address" }],
    name: "isFeedEnabled",
    outputs: [{ internalType: "bool", name: "", type: "bool" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { internalType: "address", name: "base", type: "address" },
      { internalType: "address", name: "quote", type: "address" },
    ],
    name: "latestAnswer",
    outputs: [{ internalType: "int256", name: "answer", type: "int256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { internalType: "address", name: "base", type: "address" },
      { internalType: "address", name: "quote", type: "address" },
    ],
    name: "latestRound",
    outputs: [{ internalType: "uint256", name: "roundId", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { internalType: "address", name: "base", type: "address" },
      { internalType: "address", name: "quote", type: "address" },
    ],
    name: "latestRoundData",
    outputs: [
      { internalType: "uint80", name: "roundId", type: "uint80" },
      { internalType: "int256", name: "answer", type: "int256" },
      { internalType: "uint256", name: "startedAt", type: "uint256" },
      { internalType: "uint256", name: "updatedAt", type: "uint256" },
      { internalType: "uint80", name: "answeredInRound", type: "uint80" },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { internalType: "address", name: "base", type: "address" },
      { internalType: "address", name: "quote", type: "address" },
    ],
    name: "latestTimestamp",
    outputs: [{ internalType: "uint256", name: "timestamp", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "owner",
    outputs: [{ internalType: "address", name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { internalType: "address", name: "base", type: "address" },
      { internalType: "address", name: "quote", type: "address" },
      { internalType: "address", name: "aggregator", type: "address" },
    ],
    name: "proposeFeed",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { internalType: "address", name: "base", type: "address" },
      { internalType: "address", name: "quote", type: "address" },
      { internalType: "uint80", name: "roundId", type: "uint80" },
    ],
    name: "proposedGetRoundData",
    outputs: [
      { internalType: "uint80", name: "id", type: "uint80" },
      { internalType: "int256", name: "answer", type: "int256" },
      { internalType: "uint256", name: "startedAt", type: "uint256" },
      { internalType: "uint256", name: "updatedAt", type: "uint256" },
      { internalType: "uint80", name: "answeredInRound", type: "uint80" },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { internalType: "address", name: "base", type: "address" },
      { internalType: "address", name: "quote", type: "address" },
    ],
    name: "proposedLatestRoundData",
    outputs: [
      { internalType: "uint80", name: "id", type: "uint80" },
      { internalType: "int256", name: "answer", type: "int256" },
      { internalType: "uint256", name: "startedAt", type: "uint256" },
      { internalType: "uint256", name: "updatedAt", type: "uint256" },
      { internalType: "uint80", name: "answeredInRound", type: "uint80" },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "contract AccessControllerInterface",
        name: "_accessController",
        type: "address",
      },
    ],
    name: "setAccessController",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ internalType: "address", name: "to", type: "address" }],
    name: "transferOwnership",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [],
    name: "typeAndVersion",
    outputs: [{ internalType: "string", name: "", type: "string" }],
    stateMutability: "pure",
    type: "function",
  },
  {
    inputs: [
      { internalType: "address", name: "base", type: "address" },
      { internalType: "address", name: "quote", type: "address" },
    ],
    name: "version",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
] as const;
