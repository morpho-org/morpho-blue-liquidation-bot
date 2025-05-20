import { AnvilTestClient } from "@morpho-org/test";
import { MarketState } from "../src/api/types";
import { MORPHO } from "../../client/test/constants";
import { morphoBlueAbi } from "../abis/MorphoBlue";
import { Account, Address, Hex, maxUint256 } from "viem";

export function formatMarketState(
  marketStateArray: readonly [bigint, bigint, bigint, bigint, bigint, bigint],
): MarketState {
  return {
    totalSupplyAssets: marketStateArray[0],
    totalSupplyShares: marketStateArray[1],
    totalBorrowAssets: marketStateArray[2],
    totalBorrowShares: marketStateArray[3],
    lastUpdate: marketStateArray[4],
    fee: marketStateArray[5],
  };
}

function formatMarketParams(
  marketParamsArray: readonly [Address, Address, Address, Address, bigint],
) {
  return {
    loanToken: marketParamsArray[0],
    collateralToken: marketParamsArray[1],
    oracle: marketParamsArray[2],
    irm: marketParamsArray[3],
    lltv: marketParamsArray[4],
  };
}

export function formatPosition(positionArray: readonly [bigint, bigint, bigint]) {
  return {
    collateral: positionArray[0],
    borrowShares: positionArray[1],
    supplyShares: positionArray[2],
  };
}

export async function setupBorrow(
  client: AnvilTestClient,
  marketId: Hex,
  borrower: Account,
  collateralAmount: bigint,
  loanAmount: bigint,
) {
  const _marketParams = await client.readContract({
    address: MORPHO,
    abi: morphoBlueAbi,
    functionName: "idToMarketParams",
    args: [marketId],
  });

  const marketParams = {
    loanToken: _marketParams[0],
    collateralToken: _marketParams[1],
    oracle: _marketParams[2],
    irm: _marketParams[3],
    lltv: _marketParams[4],
  };

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
    args: [marketParams, loanAmount, 0n, borrower.address, borrower.address],
  });

  return formatMarketParams(_marketParams);
}
