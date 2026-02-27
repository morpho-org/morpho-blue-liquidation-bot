import { MarketUtils } from "@morpho-org/blue-sdk";
import type { AnvilTestClient } from "@morpho-org/test";
import { ExecutorEncoder } from "executooor-viem";
import nock from "nock";
import {
  type Address,
  encodePacked,
  fromHex,
  type Hex,
  keccak256,
  maxUint128,
  maxUint256,
  toHex,
} from "viem";
import { getStorageAt, readContract } from "viem/actions";
import { vi } from "vitest";

import { morphoBlueAbi } from "../src/abis/morpho/morphoBlue";
import { OneInch } from "../src/liquidityVenues";

import { BORROW_SHARES_AND_COLLATERAL_OFFSET, borrower, MORPHO, POSITION_SLOT } from "./constants";

/// test liquidity Venues

export class OneInchTest extends OneInch {
  private readonly supportedNetworks: number[];

  constructor(supportedNetworks: number[]) {
    super();
    this.supportedNetworks = supportedNetworks;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
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

  const position = await readContract(client, {
    address: MORPHO,
    abi: morphoBlueAbi,
    functionName: "position",
    args: [marketId, borrower.address],
  });

  nock("https://api.morpho.org")
    .post("/graphql", (body) => {
      // Match the getLiquidatablePositions query
      return (
        body.query?.includes("getLiquidatablePositions") &&
        body.variables?.chainId === 1 &&
        (body.variables?.marketIds === undefined ||
          body.variables?.marketIds?.includes(marketId) ||
          body.variables?.marketIds?.length === 0)
      );
    })
    .reply(200, {
      data: {
        marketPositions: {
          __typename: "PaginatedMarketPositions",
          pageInfo: {
            __typename: "PageInfo",
            count: 1,
            countTotal: 1,
            limit: 100,
            skip: 0,
          },
          items: [
            {
              __typename: "MarketPosition",
              healthFactor: 0.5, // Less than 1 to indicate liquidatable
              user: {
                __typename: "User",
                address: borrower.address,
              },
              market: {
                __typename: "Market",
                uniqueKey: marketId,
                oracle: {
                  __typename: "Oracle",
                  address: marketParams.oracle,
                },
              },
              state: {
                __typename: "MarketPositionState",
                borrowShares: position[1].toString(),
                collateral: position[2].toString(),
                supplyShares: position[0].toString(),
              },
            },
          ],
        },
      },
    });
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
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
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

  // Use fake timers to mock Date.now() which Time.timestamp() likely uses
  vi.useFakeTimers({
    now: Number(timestamp) * 1000,
    toFake: ["Date"], // Avoid faking setTimeout, used to delay retries.
  });

  // Also set system time to ensure Time.timestamp() uses the mocked time
  vi.setSystemTime(Number(timestamp) * 1000);

  await client.setNextBlockTimestamp({ timestamp });

  return timestamp;
};
