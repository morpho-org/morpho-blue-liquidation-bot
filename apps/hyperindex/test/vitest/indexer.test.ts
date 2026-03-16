import { describe, expect } from "vitest";
import { GraphQLClient } from "graphql-request";
import gql from "graphql-tag";
import { type Address, type Hex, getAddress } from "viem";
import { readContract } from "viem/actions";
import { getChainAddresses } from "@morpho-org/blue-sdk";

import { test, END_BLOCK } from "../setup";

const GRAPHQL_URL = "http://localhost:8080/v1/graphql";
const graphqlClient = new GraphQLClient(GRAPHQL_URL);

const CHAIN_ID = 1;
const morphoAddress = getChainAddresses(CHAIN_ID).morpho as Address;

// Minimal ABIs for on-chain reads
const morphoAbi = [
  {
    inputs: [{ name: "id", type: "bytes32" }],
    name: "market",
    outputs: [
      { name: "totalSupplyAssets", type: "uint128" },
      { name: "totalSupplyShares", type: "uint128" },
      { name: "totalBorrowAssets", type: "uint128" },
      { name: "totalBorrowShares", type: "uint128" },
      { name: "lastUpdate", type: "uint128" },
      { name: "fee", type: "uint128" },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { name: "id", type: "bytes32" },
      { name: "user", type: "address" },
    ],
    name: "position",
    outputs: [
      { name: "supplyShares", type: "uint256" },
      { name: "borrowShares", type: "uint128" },
      { name: "collateral", type: "uint128" },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { name: "authorizer", type: "address" },
      { name: "authorized", type: "address" },
    ],
    name: "isAuthorized",
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

const metaMorphoAbi = [
  {
    inputs: [{ name: "", type: "uint256" }],
    name: "withdrawQueue",
    outputs: [{ name: "", type: "bytes32" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "withdrawQueueLength",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

// GraphQL queries
const GET_MARKETS = gql`
  query GetMarkets($limit: Int!) {
    Market(limit: $limit, where: { chainId: { _eq: 1 } }) {
      id
      chainId
      marketId
      loanToken
      collateralToken
      oracle
      irm
      lltv
      totalSupplyAssets
      totalSupplyShares
      totalBorrowAssets
      totalBorrowShares
      lastUpdate
      fee
      rateAtTarget
    }
  }
`;

const GET_POSITIONS = gql`
  query GetPositions($limit: Int!) {
    Position(limit: $limit, where: { chainId: { _eq: 1 } }) {
      id
      chainId
      market_id
      user
      supplyShares
      borrowShares
      collateral
    }
  }
`;

const GET_AUTHORIZATIONS = gql`
  query GetAuthorizations($limit: Int!) {
    Authorization(limit: $limit, where: { chainId: { _eq: 1 } }) {
      id
      chainId
      authorizer
      authorizee
      isAuthorized
    }
  }
`;

const GET_VAULTS = gql`
  query GetVaults($limit: Int!) {
    Vault(limit: $limit, where: { chainId: { _eq: 1 } }) {
      id
      chainId
      address
      withdrawQueue
    }
  }
`;

interface IndexedMarket {
  id: string;
  chainId: number;
  marketId: string;
  loanToken: string;
  collateralToken: string;
  oracle: string;
  irm: string;
  lltv: string;
  totalSupplyAssets: string;
  totalSupplyShares: string;
  totalBorrowAssets: string;
  totalBorrowShares: string;
  lastUpdate: string;
  fee: string;
  rateAtTarget: string;
}

interface IndexedPosition {
  id: string;
  chainId: number;
  market_id: string;
  user: string;
  supplyShares: string;
  borrowShares: string;
  collateral: string;
}

interface IndexedAuthorization {
  id: string;
  chainId: number;
  authorizer: string;
  authorizee: string;
  isAuthorized: boolean;
}

interface IndexedVault {
  id: string;
  chainId: number;
  address: string;
  withdrawQueue: string[];
}

function pickRandom<T>(arr: T[], count: number): T[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(count, arr.length));
}

describe.sequential(`HyperIndex indexer (mainnet, end block ${END_BLOCK})`, () => {
  test("markets are correctly indexed", async ({ client }) => {
    const { Market: markets } = await graphqlClient.request<{ Market: IndexedMarket[] }>(
      GET_MARKETS,
      { limit: 100 },
    );

    expect(markets.length).toBeGreaterThan(0);
    console.log(`Found ${markets.length} indexed markets, sampling 5...`);

    const sampled = pickRandom(markets, 5);

    for (const indexed of sampled) {
      const onChain = await readContract(client, {
        address: morphoAddress,
        abi: morphoAbi,
        functionName: "market",
        args: [indexed.marketId as Hex],
      });

      expect(BigInt(indexed.totalSupplyAssets)).toBe(onChain[0]);
      expect(BigInt(indexed.totalSupplyShares)).toBe(onChain[1]);
      expect(BigInt(indexed.totalBorrowAssets)).toBe(onChain[2]);
      expect(BigInt(indexed.totalBorrowShares)).toBe(onChain[3]);
      expect(BigInt(indexed.fee)).toBe(onChain[5]);

      // Skip lastUpdate check for zero-IRM markets (they never accrue interest)
      const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
      if (indexed.irm !== ZERO_ADDRESS) {
        expect(BigInt(indexed.lastUpdate)).toBe(onChain[4]);
      }
    }
  });

  test("positions are correctly indexed", async ({ client }) => {
    const { Position: positions } = await graphqlClient.request<{
      Position: IndexedPosition[];
    }>(GET_POSITIONS, { limit: 100 });

    expect(positions.length).toBeGreaterThan(0);
    console.log(`Found ${positions.length} indexed positions, sampling 10...`);

    const sampled = pickRandom(positions, 10);

    for (const indexed of sampled) {
      // market_id format is "chainId-marketId"
      const rawMarketId = indexed.market_id.replace(`${CHAIN_ID}-`, "") as Hex;

      // Indexed addresses are lowercase; getAddress() checksums for on-chain call
      const onChain = await readContract(client, {
        address: morphoAddress,
        abi: morphoAbi,
        functionName: "position",
        args: [rawMarketId, getAddress(indexed.user) as Address],
      });

      expect(BigInt(indexed.supplyShares)).toBe(onChain[0]);
      expect(BigInt(indexed.borrowShares)).toBe(onChain[1]);
      expect(BigInt(indexed.collateral)).toBe(onChain[2]);
    }
  });

  test("authorizations are correctly indexed", async ({ client }) => {
    const { Authorization: authorizations } = await graphqlClient.request<{
      Authorization: IndexedAuthorization[];
    }>(GET_AUTHORIZATIONS, { limit: 100 });

    expect(authorizations.length).toBeGreaterThan(0);
    console.log(`Found ${authorizations.length} indexed authorizations, sampling 10...`);

    const sampled = pickRandom(authorizations, 10);

    for (const indexed of sampled) {
      // Indexed addresses are lowercase; getAddress() checksums for on-chain call
      const onChain = await readContract(client, {
        address: morphoAddress,
        abi: morphoAbi,
        functionName: "isAuthorized",
        args: [
          getAddress(indexed.authorizer) as Address,
          getAddress(indexed.authorizee) as Address,
        ],
      });

      expect(indexed.isAuthorized).toBe(onChain);
    }
  });

  test("vaults are correctly indexed", async ({ client }) => {
    const { Vault: vaults } = await graphqlClient.request<{ Vault: IndexedVault[] }>(
      GET_VAULTS,
      { limit: 10 },
    );

    expect(vaults.length).toBeGreaterThan(0);
    console.log(`Found ${vaults.length} indexed vaults, sampling 1...`);

    const sampled = pickRandom(vaults, 1);

    for (const indexed of sampled) {
      // Indexed addresses are lowercase; getAddress() checksums for on-chain call
      const vaultAddress = getAddress(indexed.address) as Address;

      const queueLength = await readContract(client, {
        address: vaultAddress,
        abi: metaMorphoAbi,
        functionName: "withdrawQueueLength",
      });

      expect(indexed.withdrawQueue.length).toBe(Number(queueLength));

      for (let i = 0; i < indexed.withdrawQueue.length; i++) {
        const onChainMarketId = await readContract(client, {
          address: vaultAddress,
          abi: metaMorphoAbi,
          functionName: "withdrawQueue",
          args: [BigInt(i)],
        });

        expect(indexed.withdrawQueue[i]).toBe(onChainMarketId);
      }
    }
  });
});
