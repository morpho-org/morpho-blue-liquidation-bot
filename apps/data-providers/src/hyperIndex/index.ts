import { exec, execSync, type ChildProcess } from "node:child_process";

import { hyperIndexChainConfigs } from "@morpho-blue-liquidation-bot/config";
import { AccrualPosition, Market, PreLiquidationPosition } from "@morpho-org/blue-sdk";
import { GraphQLClient } from "graphql-request";
import gql from "graphql-tag";
import type { Account, Address, Chain, Client, Hex, Transport } from "viem";
import { getAddress } from "viem";
import { readContract } from "viem/actions";

import type { DataProvider, LiquidatablePositionsResult } from "../dataProvider";

const DEFAULT_HYPERINDEX_URL = "http://localhost:8080/v1/graphql";
const HEALTH_CHECK_INTERVAL_MS = 500;
const SPINNER_FRAMES = ["◰", "◳", "◲", "◱"];
const HEALTH_CHECK_TIMEOUT_MS = 7_200_000; // 2 hours — full Arbitrum RPC backfill can take a long time
const BACKFILL_TOLERANCE_BLOCKS = 100; // consider "caught up" when within this many blocks of tip

const oracleAbi = [
  {
    type: "function",
    name: "price",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
] as const;

const POSITIONS_PAGE_SIZE = 1000;

const GET_POSITIONS = gql`
  query GetPositions($marketIds: [String!]!, $limit: Int!, $offset: Int!) {
    Position(
      where: { market_id: { _in: $marketIds }, borrowShares: { _gt: "0" } }
      limit: $limit
      offset: $offset
    ) {
      user
      market_id
      supplyShares
      borrowShares
      collateral
    }
  }
`;

const GET_MARKETS = gql`
  query GetMarkets($marketIds: [String!]!) {
    Market(where: { id: { _in: $marketIds } }) {
      id
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

const GET_PRELIQUIDATION_CONTRACTS = gql`
  query GetPreLiquidationContracts($marketIds: [String!]!) {
    PreLiquidationContract(where: { market_id: { _in: $marketIds } }) {
      market_id
      address
      preLltv
      preLCF1
      preLCF2
      preLIF1
      preLIF2
      preLiquidationOracle
    }
  }
`;

const GET_AUTHORIZATIONS = gql`
  query GetAuthorizations($chainId: Int!, $authorizees: [String!]!) {
    Authorization(
      where: {
        isAuthorized: { _eq: true }
        chainId: { _eq: $chainId }
        authorizee: { _in: $authorizees }
      }
    ) {
      authorizer
      authorizee
    }
  }
`;

const GET_VAULT_MARKETS = gql`
  query GetVaultMarkets($vaultIds: [String!]!) {
    Vault(where: { id: { _in: $vaultIds } }) {
      id
      withdrawQueue(order_by: { ordinal: asc }) {
        market_id
      }
    }
  }
`;

interface HyperIndexPosition {
  user: string;
  market_id: string;
  supplyShares: string;
  borrowShares: string;
  collateral: string;
}

interface HyperIndexMarket {
  id: string;
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

interface HyperIndexPreLiquidationContract {
  market_id: string;
  address: string;
  preLltv: string;
  preLCF1: string;
  preLCF2: string;
  preLIF1: string;
  preLIF2: string;
  preLiquidationOracle: string;
}

interface HyperIndexAuthorization {
  authorizer: string;
  authorizee: string;
}

interface HyperIndexVault {
  id: string;
  withdrawQueue: { market_id: string }[];
}

interface PositionsResponse {
  Position: HyperIndexPosition[];
}

interface MarketsResponse {
  Market: HyperIndexMarket[];
}

interface PreLiquidationContractsResponse {
  PreLiquidationContract: HyperIndexPreLiquidationContract[];
}

interface AuthorizationsResponse {
  Authorization: HyperIndexAuthorization[];
}

interface VaultMarketsResponse {
  Vault: HyperIndexVault[];
}

function progressBar(current: number, total: number, width = 30): string {
  const ratio = Math.min(current / total, 1);
  const filled = Math.round(width * ratio);
  return `${"█".repeat(filled)}${"░".repeat(width - filled)}`;
}

export interface HyperIndexDataProviderOptions {
  /** URL of an externally hosted HyperIndex instance. If set, selfhost is skipped. */
  url?: string;
}

export class HyperIndexDataProvider implements DataProvider {
  private readonly graphqlClient: GraphQLClient;
  private readonly url: string;
  private readonly selfhost: boolean;
  private indexerProcess?: ChildProcess;

  constructor(options?: HyperIndexDataProviderOptions) {
    const externalUrl = options?.url ?? process.env.HYPERINDEX_URL;
    this.url = externalUrl ?? DEFAULT_HYPERINDEX_URL;
    this.selfhost = !externalUrl;
    this.graphqlClient = new GraphQLClient(this.url);
  }

  async init(): Promise<void> {
    if (!this.selfhost) {
      console.log(`[HyperIndex] Using external instance at ${this.url}`);
      await this.waitForReady();
      return;
    }

    const hyperindexDir = new URL("../../../hyperindex", import.meta.url).pathname;

    console.log("[HyperIndex] Generating config...");
    execSync("pnpm generate:config", { cwd: hyperindexDir, stdio: "inherit" });

    console.log("[HyperIndex] Starting local indexer...");
    this.indexerProcess = exec("TUI_OFF=true pnpm dev", {
      cwd: hyperindexDir,
    });

    this.indexerProcess.stdout?.on("data", (data: string) => {
      process.stdout.write(`[HyperIndex] ${data}`);
    });

    this.indexerProcess.stderr?.on("data", (data: string) => {
      process.stderr.write(`[HyperIndex] ${data}`);
    });

    this.indexerProcess.on("error", (err) => {
      console.error(`[HyperIndex] Failed to start indexer process: ${err.message}`);
    });

    this.indexerProcess.on("exit", (code) => {
      if (code !== null && code !== 0) {
        console.error(`[HyperIndex] Indexer process exited with code ${code}`);
      }
    });

    await this.waitForReady();
    console.log("[HyperIndex] Indexer is ready");
  }

  async fetchMarkets(client: Client<Transport, Chain, Account>, vaults: Address[]): Promise<Hex[]> {
    try {
      const vaultIds = vaults.map((v) => `${client.chain.id}-${v.toLowerCase()}`);

      const response = await this.graphqlClient.request<VaultMarketsResponse>(GET_VAULT_MARKETS, {
        vaultIds,
      });

      const marketIds = response.Vault.flatMap((vault) =>
        vault.withdrawQueue.filter((item) => item.market_id != null).map((item) => item.market_id),
      );
      return [...new Set(marketIds)] as Hex[];
    } catch (error) {
      console.error(`Error fetching markets from HyperIndex: ${error}`);
      return [];
    }
  }

  async fetchLiquidatablePositions(
    client: Client<Transport, Chain, Account>,
    marketIds: Hex[],
  ): Promise<LiquidatablePositionsResult> {
    try {
      const indexedMarketIds = marketIds.map((id) => `${client.chain.id}-${id.toLowerCase()}`);

      // 1. Fetch positions (with pagination), markets, and preLiquidation contracts in parallel
      const allPositions: HyperIndexPosition[] = [];
      const fetchPositions = async () => {
        let offset = 0;
        while (true) {
          const page = await this.graphqlClient.request<PositionsResponse>(GET_POSITIONS, {
            marketIds: indexedMarketIds,
            limit: POSITIONS_PAGE_SIZE,
            offset,
          });
          allPositions.push(...page.Position);
          if (page.Position.length < POSITIONS_PAGE_SIZE) break;
          offset += POSITIONS_PAGE_SIZE;
        }
      };

      const [, marketsResponse, preLiqContracts] = await Promise.all([
        fetchPositions(),
        this.graphqlClient.request<MarketsResponse>(GET_MARKETS, {
          marketIds: indexedMarketIds,
        }),
        this.graphqlClient.request<PreLiquidationContractsResponse>(GET_PRELIQUIDATION_CONTRACTS, {
          marketIds: indexedMarketIds,
        }),
      ]);

      if (allPositions.length === 0) {
        return { liquidatablePositions: [], preLiquidatablePositions: [] };
      }

      // 2. Fetch authorizations filtered by preLiquidation contract addresses
      const preLiqAddresses = preLiqContracts.PreLiquidationContract.map((plc) =>
        plc.address.toLowerCase(),
      );

      let authorizations: AuthorizationsResponse = { Authorization: [] };
      if (preLiqAddresses.length > 0) {
        authorizations = await this.graphqlClient.request<AuthorizationsResponse>(
          GET_AUTHORIZATIONS,
          {
            chainId: client.chain.id,
            authorizees: preLiqAddresses,
          },
        );
      }

      // 3. Collect all unique oracle addresses (market oracles + preLiquidation oracles)
      const oracleAddresses = new Set<Address>();
      for (const m of marketsResponse.Market) {
        oracleAddresses.add(getAddress(m.oracle));
      }
      for (const plc of preLiqContracts.PreLiquidationContract) {
        oracleAddresses.add(getAddress(plc.preLiquidationOracle));
      }

      // 4. Fetch all oracle prices on-chain in parallel (deduplicated)
      const oraclePrices = new Map<Address, bigint | undefined>();
      await Promise.all(
        [...oracleAddresses].map(async (oracle) => {
          try {
            const price = await readContract(client, {
              address: oracle,
              abi: oracleAbi,
              functionName: "price",
            });
            oraclePrices.set(oracle, price);
          } catch {
            oraclePrices.set(oracle, undefined);
          }
        }),
      );

      // 5. Build Market objects from indexed data + on-chain oracle prices
      const marketsMap = new Map<string, Market>();
      const now = BigInt(Math.floor(Date.now() / 1000));

      for (const m of marketsResponse.Market) {
        const oracleAddress = getAddress(m.oracle);
        const price = oraclePrices.get(oracleAddress);

        const market = new Market({
          params: {
            loanToken: getAddress(m.loanToken),
            collateralToken: getAddress(m.collateralToken),
            oracle: oracleAddress,
            irm: getAddress(m.irm),
            lltv: BigInt(m.lltv),
          },
          totalSupplyAssets: BigInt(m.totalSupplyAssets),
          totalSupplyShares: BigInt(m.totalSupplyShares),
          totalBorrowAssets: BigInt(m.totalBorrowAssets),
          totalBorrowShares: BigInt(m.totalBorrowShares),
          lastUpdate: BigInt(m.lastUpdate),
          fee: BigInt(m.fee),
          rateAtTarget: BigInt(m.rateAtTarget),
          price,
        }).accrueInterest(now);

        marketsMap.set(m.id, market);
      }

      // 6. Build liquidatable positions
      const liquidatablePositions = allPositions
        .map((p) => {
          const market = marketsMap.get(p.market_id);
          if (!market) return;

          return new AccrualPosition(
            {
              user: getAddress(p.user),
              supplyShares: BigInt(p.supplyShares),
              borrowShares: BigInt(p.borrowShares),
              collateral: BigInt(p.collateral),
            },
            market,
          );
        })
        .filter((p) => p !== undefined)
        .filter((p) => p.seizableCollateral !== undefined);

      // 7. Build pre-liquidatable positions
      //    Match: position.user authorized the preLiquidation contract address
      const authorizedSet = new Set<string>();
      for (const auth of authorizations.Authorization) {
        authorizedSet.add(`${getAddress(auth.authorizer)}-${getAddress(auth.authorizee)}`);
      }

      // Group preLiquidation contracts by market
      const preLiqContractsByMarket = new Map<string, HyperIndexPreLiquidationContract[]>();
      for (const plc of preLiqContracts.PreLiquidationContract) {
        const existing = preLiqContractsByMarket.get(plc.market_id) ?? [];
        existing.push(plc);
        preLiqContractsByMarket.set(plc.market_id, existing);
      }

      // For each borrowing position, check if the user authorized any preLiquidation contract
      const preLiqCandidates: PreLiquidationPosition[] = [];

      for (const p of allPositions) {
        if (!indexedMarketIds.includes(p.market_id)) continue;

        const market = marketsMap.get(p.market_id);
        if (!market) continue;

        const contracts = preLiqContractsByMarket.get(p.market_id);
        if (!contracts) continue;

        for (const plc of contracts) {
          // Check if user authorized this preLiquidation contract
          const userAddress = getAddress(p.user);
          const plcAddress = getAddress(plc.address);
          const authKey = `${userAddress}-${plcAddress}`;
          if (!authorizedSet.has(authKey)) continue;

          const preLiqOracleAddress = getAddress(plc.preLiquidationOracle);
          const preLiqOraclePrice = oraclePrices.get(preLiqOracleAddress);

          const preLiqPosition = new PreLiquidationPosition(
            {
              user: userAddress,
              supplyShares: BigInt(p.supplyShares),
              borrowShares: BigInt(p.borrowShares),
              collateral: BigInt(p.collateral),
              preLiquidation: plcAddress,
              preLiquidationParams: {
                preLltv: BigInt(plc.preLltv),
                preLCF1: BigInt(plc.preLCF1),
                preLCF2: BigInt(plc.preLCF2),
                preLIF1: BigInt(plc.preLIF1),
                preLIF2: BigInt(plc.preLIF2),
                preLiquidationOracle: preLiqOracleAddress,
              },
              preLiquidationOraclePrice: preLiqOraclePrice,
            },
            market,
          );

          if (
            preLiqPosition.seizableCollateral !== undefined &&
            preLiqPosition.seizableCollateral > 0n
          ) {
            preLiqCandidates.push(preLiqPosition);
          }
        }
      }

      // Sort by seizable collateral descending, keep only the best contract per user per market
      preLiqCandidates.sort((a, b) =>
        (a.seizableCollateral ?? 0n) > (b.seizableCollateral ?? 0n) ? -1 : 1,
      );

      const seenUsers = new Set<string>();
      const preLiquidatablePositions: PreLiquidationPosition[] = [];

      for (const pos of preLiqCandidates) {
        const key = `${pos.market.id}-${pos.user}`;
        if (!seenUsers.has(key)) {
          preLiquidatablePositions.push(pos);
          seenUsers.add(key);
        }
      }

      return { liquidatablePositions, preLiquidatablePositions };
    } catch (error) {
      console.error(`Error fetching liquidatable positions from HyperIndex: ${error}`);
      return { liquidatablePositions: [], preLiquidatablePositions: [] };
    }
  }

  private async getChainTip(chainId: number): Promise<number | undefined> {
    const rpcUrl = process.env[`RPC_URL_${chainId}`];
    if (!rpcUrl) return undefined;

    try {
      const res = await fetch(rpcUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", method: "eth_blockNumber", params: [], id: 1 }),
      });
      const data = (await res.json()) as { result?: string };
      return data.result ? Number.parseInt(data.result, 16) : undefined;
    } catch {
      return undefined;
    }
  }

  private async waitForReady(): Promise<void> {
    const start = Date.now();
    const chainTips = new Map<number, number>();
    let spinnerIdx = 0;
    let lineCount = 0;

    while (Date.now() - start < HEALTH_CHECK_TIMEOUT_MS) {
      try {
        const data = await this.graphqlClient.request<{
          chain_metadata: { chain_id: number; latest_processed_block: number }[];
        }>(gql`
          {
            chain_metadata {
              chain_id
              latest_processed_block
            }
          }
        `);

        const chains = data.chain_metadata ?? [];
        if (chains.length === 0) {
          await new Promise((resolve) => setTimeout(resolve, HEALTH_CHECK_INTERVAL_MS));
          continue;
        }

        // Fetch chain tips once per chain
        for (const c of chains) {
          if (!chainTips.has(c.chain_id)) {
            const tip = await this.getChainTip(c.chain_id);
            if (tip) chainTips.set(c.chain_id, tip);
          }
        }

        // Check if all chains are caught up
        let allCaughtUp = true;
        for (const c of chains) {
          const tip = chainTips.get(c.chain_id);
          if (tip) {
            if (tip - c.latest_processed_block > BACKFILL_TOLERANCE_BLOCKS) {
              allCaughtUp = false;
            }
          } else if (c.latest_processed_block < 0) {
            allCaughtUp = false;
          }
        }

        // Overwrite previous lines to create a rolling progress display
        if (lineCount > 0) {
          process.stdout.write(`\x1b[${lineCount}A`);
        }

        const elapsed = ((Date.now() - start) / 1000).toFixed(0);
        const spinner = SPINNER_FRAMES[spinnerIdx % SPINNER_FRAMES.length];
        spinnerIdx++;

        lineCount = 0;
        for (const c of chains) {
          const tip = chainTips.get(c.chain_id);
          const startBlock = hyperIndexChainConfigs[c.chain_id]?.morphoStartBlock ?? 0;
          if (tip) {
            const progress = c.latest_processed_block - startBlock;
            const total = tip - startBlock;
            const pct = total > 0 ? ((progress / total) * 100).toFixed(1) : "0.0";
            const bar = progressBar(progress, total);
            process.stdout.write(
              `\x1b[2K${spinner} [HyperIndex] Chain ${c.chain_id}: ${bar} ${pct}% (${c.latest_processed_block.toLocaleString()} / ${tip.toLocaleString()}) [${elapsed}s]\n`,
            );
          } else {
            process.stdout.write(
              `\x1b[2K${spinner} [HyperIndex] Chain ${c.chain_id}: block ${c.latest_processed_block.toLocaleString()} [${elapsed}s]\n`,
            );
          }
          lineCount++;
        }

        if (allCaughtUp) {
          console.log("[HyperIndex] Backfill complete");
          return;
        }
      } catch {
        // Hasura not up yet or table not created
      }

      await new Promise((resolve) => setTimeout(resolve, HEALTH_CHECK_INTERVAL_MS));
    }

    throw new Error(
      `[HyperIndex] Timed out waiting for backfill at ${this.url} after ${HEALTH_CHECK_TIMEOUT_MS / 1000}s`,
    );
  }
}
