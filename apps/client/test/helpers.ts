import { AccrualPosition, Market, MarketParams, MarketUtils } from "@morpho-org/blue-sdk";
import { adaptiveCurveIrmAbi } from "@morpho-org/blue-sdk-viem";
import { Time } from "@morpho-org/morpho-ts";
import type { AnvilTestClient } from "@morpho-org/test";
import { ExecutorEncoder } from "executooor-viem";
import nock from "nock";
import {
  type Address,
  type Client,
  encodePacked,
  fromHex,
  type Hex,
  keccak256,
  maxUint128,
  maxUint256,
  toHex,
} from "viem";
import { getStorageAt, multicall, readContract } from "viem/actions";
import { vi } from "vitest";

import { morphoBlueAbi } from "../src/abis/morpho/morphoBlue";
import { oracleAbi } from "../src/abis/morpho/oracle";
import type { Indexer } from "../src/indexer/Indexer";
import { OneInch } from "../src/liquidityVenues";

import { BORROW_SHARES_AND_COLLATERAL_OFFSET, borrower, MORPHO, POSITION_SLOT } from "./constants";

/// test liquidity Venues

export class OneInchTest extends OneInch {
  private readonly supportedNetworks: number[];

  constructor(supportedNetworks: number[]) {
    super();
    this.supportedNetworks = supportedNetworks;
  }

  supportsRoute(encoder: ExecutorEncoder, _src: Address, _dst: Address) {
    return this.supportedNetworks.includes(encoder.client.chain.id);
  }
}

export async function setupPosition(
  client: AnvilTestClient,
  marketParams: {
    loanToken: Address;
    collateralToken: Address;
    oracle: Address;
    irm: Address;
    lltv: bigint;
  },
  collateralAmount: bigint,
  borrowAmount: bigint,
) {
  const marketId = MarketUtils.getMarketId(marketParams);

  await client.deal({
    erc20: marketParams.collateralToken,
    account: borrower.address,
    amount: collateralAmount,
  });

  await client.approve({
    account: borrower,
    address: marketParams.collateralToken,
    args: [MORPHO, maxUint256],
  });

  await client.writeContract({
    account: borrower,
    address: MORPHO,
    abi: morphoBlueAbi,
    functionName: "supplyCollateral",
    args: [marketParams, collateralAmount, borrower.address, "0x"],
  });

  await client.writeContract({
    account: borrower,
    address: MORPHO,
    abi: morphoBlueAbi,
    functionName: "borrow",
    args: [marketParams, borrowAmount, 0n, borrower.address, borrower.address],
  });

  await overwriteCollateral(client, marketId, borrower.address, collateralAmount / 2n);
}

export function mockEtherPrice(
  etherPrice: number,
  marketParams: {
    loanToken: Address;
    collateralToken: Address;
    oracle: Address;
    irm: Address;
    lltv: bigint;
  },
) {
  nock("https://blue-api.morpho.org")
    .post("/graphql")
    .reply(200, {
      data: {
        chains: [{ id: 1 }],
      },
    })
    .post("/graphql")
    .reply(200, {
      data: {
        chains: [{ id: 1 }],
      },
    })
    .post("/graphql")
    .reply(200, {
      data: {
        assets: {
          items: [
            { address: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", priceUsd: etherPrice },
            { address: marketParams.loanToken, priceUsd: 1 },
          ],
        },
      },
    })
    .post("/graphql")
    .reply(200, {
      data: {
        assets: {
          items: [
            { address: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", priceUsd: etherPrice },
            { address: marketParams.collateralToken, priceUsd: 1 },
          ],
        },
      },
    });
}

async function overwriteCollateral(
  client: AnvilTestClient,
  marketId: Hex,
  user: Address,
  amount: bigint,
) {
  const slot = borrowSharesAndCollateralSlot(user, marketId);

  const value = await getStorageAt(client, {
    address: MORPHO,
    slot,
  });

  await client.setStorageAt({
    address: MORPHO,
    index: slot,

    value: modifyCollateralSlot(value!, amount),
  });
}

function borrowSharesAndCollateralSlot(user: Address, marketId: Hex) {
  return padToBytes32(
    toHex(
      fromHex(
        keccak256(
          encodePacked(
            ["bytes32", "bytes32"],
            [
              padToBytes32(user),
              keccak256(encodePacked(["bytes32", "uint256"], [marketId, POSITION_SLOT])),
            ],
          ),
        ),
        "bigint",
      ) + BORROW_SHARES_AND_COLLATERAL_OFFSET,
    ),
  );
}

function padToBytes32(hex: `0x${string}`, bytes = 32): Hex {
  const withoutPrefix = hex.slice(2);
  const padded = withoutPrefix.padStart(2 * bytes, "0");
  return `0x${padded}`;
}

function modifyCollateralSlot(value: Hex, amount: bigint) {
  if (amount > maxUint128) throw new Error("Amount is too large");

  const collateralBytes = padToBytes32(toHex(amount), 16);
  const slotBytes = value.slice(34);

  return `${collateralBytes}${slotBytes}` as Hex;
}

export const syncTimestamp = async (client: AnvilTestClient, timestamp?: bigint) => {
  timestamp ??= (await client.timestamp()) + 60n;

  vi.useFakeTimers({
    now: Number(timestamp) * 1000,
    toFake: ["Date"], // Avoid faking setTimeout, used to delay retries.
  });

  // Also set system time to ensure Time.timestamp() uses the mocked time
  vi.setSystemTime(Number(timestamp) * 1000);

  await client.setNextBlockTimestamp({ timestamp });

  return timestamp;
};

/// Mock Indexer for tests

export class MockIndexer {
  private client: Client;
  private morphoAddress: Address;
  private positions: { marketId: Hex; user: Address }[] = [];

  constructor(client: Client, morphoAddress: Address) {
    this.client = client;
    this.morphoAddress = morphoAddress;
  }

  addPosition(marketId: Hex, user: Address) {
    this.positions.push({ marketId, user });
  }

  async init() {}
  async sync() {}
  updateVaultAddresses() {}
  getMarketsForVaults() {
    return [];
  }

  async getLiquidatablePositions(_coveredMarketIds: Hex[]) {
    const liquidatablePositions: AccrualPosition[] = [];

    for (const { marketId, user } of this.positions) {
      const [params, marketState, posState] = await Promise.all([
        readContract(this.client, {
          address: this.morphoAddress,
          abi: morphoBlueAbi,
          functionName: "idToMarketParams",
          args: [marketId],
        }),
        readContract(this.client, {
          address: this.morphoAddress,
          abi: morphoBlueAbi,
          functionName: "market",
          args: [marketId],
        }),
        readContract(this.client, {
          address: this.morphoAddress,
          abi: morphoBlueAbi,
          functionName: "position",
          args: [marketId, user],
        }),
      ]);

      // Fetch oracle price
      const oraclePrice = await readContract(this.client, {
        address: params[2],
        abi: oracleAbi,
        functionName: "price",
      });

      // Fetch rateAtTarget from IRM (may fail for non-adaptive IRMs)
      let rateAtTarget: bigint | undefined;
      try {
        const results = await multicall(this.client, {
          contracts: [
            {
              address: params[3],
              abi: adaptiveCurveIrmAbi,
              functionName: "rateAtTarget" as const,
              args: [marketId],
            },
          ],
          allowFailure: true,
        });
        if (results[0].status === "success") {
          rateAtTarget = results[0].result;
        }
      } catch {
        // IRM may not be adaptive curve
      }

      const market = new Market({
        params: new MarketParams({
          loanToken: params[0],
          collateralToken: params[1],
          oracle: params[2],
          irm: params[3],
          lltv: params[4],
        }),
        totalSupplyAssets: marketState[0],
        totalSupplyShares: marketState[1],
        totalBorrowAssets: marketState[2],
        totalBorrowShares: marketState[3],
        lastUpdate: marketState[4],
        fee: marketState[5],
        price: oraclePrice,
        rateAtTarget,
      });

      const accrualPos = new AccrualPosition(
        { user, supplyShares: posState[0], borrowShares: posState[1], collateral: posState[2] },
        market,
      );

      const now = Time.timestamp();
      const accrued = accrualPos.accrueInterest(now);

      if (accrued.seizableCollateral !== undefined && accrued.seizableCollateral !== 0n) {
        liquidatablePositions.push(accrued);
      }
    }

    return { liquidatablePositions, preLiquidatablePositions: [] as never[] };
  }

  /** Cast to Indexer type for use in LiquidationBot */
  asIndexer(): Indexer {
    return this as unknown as Indexer;
  }
}
