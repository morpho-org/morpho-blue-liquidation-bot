import { executorAbi } from "executooor-viem";
import nock from "nock";
import { Address, erc20Abi, Hex, maxUint256, parseUnits } from "viem";
import { readContract, writeContract } from "viem/actions";
import { afterEach, describe, expect, vi } from "vitest";

import { PendlePTVenue } from "../../../src/liquidityVenues/pendlePT";
import { USDC, WBTC } from "../../constants";
import { syncTimestamp } from "../../helpers";
import { pendlePTTest } from "../../setup";

const collateral = "0x62C6E813b9589C3631Ba0Cdb013acdB8544038B7" as Address; // PT-USDE-27NOV2025 (maturity not reached)
const underlying = "0x4c9EDD5852cd905f086C759E8383e09bff1E68B3" as Address; // USDe

const collateralAmount = parseUnits("10000", 18);
const pendlePTVenue = new PendlePTVenue();

describe("Pendle PT liquidity venue", () => {
  pendlePTTest.sequential(`should test supportsRoute`, async ({ encoder }) => {
    nock("https://api-v2.pendle.finance/core/")
      .get("/v1/markets/all?chainId=1")
      .reply(200, {
        markets: [
          {
            name: "USDe",
            address: "0x4eaa571eafcd96f51728756bd7f396459bb9b869",
            expiry: "2025-11-27T00:00:00.000Z",
            pt: "1-0x62c6e813b9589c3631ba0cdb013acdb8544038b7",
            yt: "1-0x99c92d4da7a81c7698ef33a39d7538d0f92623f7",
            sy: "1-0x925a15bd6a1582fa7c0ebbfc3dbd29c34f58340e",
            underlyingAsset: "1-0x4c9edd5852cd905f086c759e8383e09bff1e68b3",
            details: {
              liquidity: 23002799.475931928,
              pendleApy: 0.03192469329696868,
              impliedApy: 0.07087439363390913,
              feeRate: 0.0008829999999999671,
              movement10Percent: {
                ptMovementUpUsd: 124490737.4239579,
                ptMovementDownUsd: 9298986.481139513,
                ytMovementUpUsd: 1346212.8176518613,
                ytMovementDownUsd: 97222.97383354748,
              },
              yieldRange: {
                min: 0.05000000000000001,
                max: 0.26999999999999996,
              },
              aggregatedApy: 0.04866554098434125,
              maxBoostedApy: 0.09655258092979427,
            },
            isNew: false,
            isPrime: true,
            timestamp: "2025-08-12T03:01:35.000Z",
            lpWrapper: "1-0x380c355faa9b6696c2434314f10f9a2ce451d15a",
            categoryIds: ["stables", "points", "ethena"],
            chainId: 1,
          },
        ],
      });

    expect(await pendlePTVenue.supportsRoute(encoder, collateral, USDC)).toBe(true);
    expect(await pendlePTVenue.supportsRoute(encoder, WBTC, collateral)).toBe(false);
  });

  pendlePTTest.sequential(
    `should swap a PT token to the underlying token market before maturity`,
    async ({ client, encoder }) => {
      await syncTimestamp(client);

      // data returned by the api at the block timestamp
      const tx = {
        data: "0x594a88cc000000000000000000000000767a702a317ecd9dd373048dd1a6a3eea87211690000000000000000000000004eaa571eafcd96f51728756bd7f396459bb9b86900000000000000000000000000000000000000000000021e19e0c9bab240000000000000000000000000000000000000000000000000000000000000000000a000000000000000000000000000000000000000000000000000000000000001e00000000000000000000000004c9edd5852cd905f086c759e8383e09bff1e68b30000000000000000000000000000000000000000000002030ba79fbee409ad770000000000000000000000004c9edd5852cd905f086c759e8383e09bff1e68b3000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000a0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000080000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000a000000000000000000000000000000000000000000000000000000000000000c000000000000000000000000000000000000000000000000000000000000000e0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000",
        to: "0x888888888889758F76e7103c6CbF23ABbF58F946",
        from: "0x767a702a317ecd9dd373048dd1a6a3eea8721169",
      };

      const amountOut = "9896784389018922303324";

      encoder
        .erc20Approve(collateral, tx.to as Address, maxUint256)
        .pushCall(tx.to as Address, 0n, tx.data as Hex);

      const expectedCalls = encoder.flush();

      nock.cleanAll();

      nock("https://api-v2.pendle.finance/core/")
        .get(
          "/v2/sdk/1/markets/0x4eaa571eafcd96f51728756bd7f396459bb9b869/swap?receiver=0x767a702a317ecd9dd373048dd1a6a3eea8721169&slippage=0.04&tokenIn=0x62c6e813b9589c3631ba0cdb013acdb8544038b7&tokenOut=0x4c9edd5852cd905f086c759e8383e09bff1e68b3&amountIn=10000000000000000000000",
        )
        .reply(200, {
          method: "swapExactPtForToken",
          contractCallParamsName: ["receiver", "market", "exactPtIn", "output", "limit"],
          contractCallParams: [
            "0x767a702a317ecd9dd373048dd1a6a3eea8721169",
            "0x4eaa571eafcd96f51728756bd7f396459bb9b869",
            "10000000000000000000000",
            {
              tokenOut: "0x4c9edd5852cd905f086c759e8383e09bff1e68b3",
              minTokenOut: "9500913013458165411191",
              tokenRedeemSy: "0x4c9edd5852cd905f086c759e8383e09bff1e68b3",
              pendleSwap: "0x0000000000000000000000000000000000000000",
              swapData: [Object],
            },
            {
              limitRouter: "0x0000000000000000000000000000000000000000",
              epsSkipMarket: "0",
              normalFills: [],
              flashFills: [],
              optData: "0x",
            },
          ],
          tx,
          tokenApprovals: [
            {
              token: "0x62c6e813b9589c3631ba0cdb013acdb8544038b7",
              amount: "10000000000000000000000",
            },
          ],
          computingUnit: 0,
          data: {
            amountOut,
            priceImpact: -0.00015758593714848402,
          },
        });

      await pendlePTVenue.convert(encoder, {
        src: collateral,
        dst: USDC,
        srcAmount: collateralAmount,
      });

      const encodedCalls = encoder.flush();

      expect(encodedCalls).toEqual(expectedCalls);

      await encoder.client.deal({
        erc20: collateral,
        account: encoder.address,
        amount: collateralAmount,
      });

      const [encoderCollateralBalanceBefore, encoderUnderlyingBalanceBefore] = await Promise.all([
        readContract(encoder.client, {
          address: collateral,
          abi: erc20Abi,
          functionName: "balanceOf",
          args: [encoder.address],
        }),
        readContract(encoder.client, {
          address: underlying,
          abi: erc20Abi,
          functionName: "balanceOf",
          args: [encoder.address],
        }),
      ]);

      expect(encoderCollateralBalanceBefore).toBe(collateralAmount);
      expect(encoderUnderlyingBalanceBefore).toBe(0n);

      const functionData = {
        abi: executorAbi,
        functionName: "exec_606BaXt",
        args: [encodedCalls],
      } as const;

      await writeContract(encoder.client, { address: encoder.address, ...functionData });

      const [encoderCollateralBalanceAfter, encoderUnderlyingBalanceAfter] = await Promise.all([
        readContract(encoder.client, {
          address: collateral,
          abi: erc20Abi,
          functionName: "balanceOf",
          args: [encoder.address],
        }),
        readContract(encoder.client, {
          address: underlying,
          abi: erc20Abi,
          functionName: "balanceOf",
          args: [encoder.address],
        }),
      ]);

      expect(encoderCollateralBalanceAfter).toBe(0n);
      expect(encoderUnderlyingBalanceAfter).toBeGreaterThanOrEqual(BigInt(amountOut));
    },
  );

  pendlePTTest.sequential(
    `should swap a PT token to the underlying token market after maturity`,
    async ({ client, encoder }) => {
      const postMaturity = BigInt(new Date("2025-11-27T00:00:00.000Z").getTime() / 1000 + 100);
      await syncTimestamp(client, postMaturity);

      // data returned by the api at the block timestamp
      const tx = {
        data: "0x47f1de22000000000000000000000000767a702a317ecd9dd373048dd1a6a3eea872116900000000000000000000000099c92d4da7a81c7698ef33a39d7538d0f92623f700000000000000000000000000000000000000000000021e19e0c9bab240000000000000000000000000000000000000000000000000000000000000000000800000000000000000000000004c9edd5852cd905f086c759e8383e09bff1e68b30000000000000000000000000000000000000000000002086ac35105260000000000000000000000000000004c9edd5852cd905f086c759e8383e09bff1e68b3000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000a000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000008000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000",
        to: "0x888888888889758F76e7103c6CbF23ABbF58F946",
        from: "0x767a702a317ecd9dd373048dd1a6a3eea8721169",
      };

      const amountOut = "10000000000000000000000";

      encoder
        .erc20Approve(collateral, tx.to as Address, maxUint256)
        .pushCall(tx.to as Address, 0n, tx.data as Hex);

      const expectedCalls = encoder.flush();

      nock.cleanAll();

      nock("https://api-v2.pendle.finance/core/")
        .get(
          "/v2/sdk/1/redeem?receiver=0x767a702a317ecd9dd373048dd1a6a3eea8721169&slippage=0.04&yt=0x99c92d4da7a81c7698ef33a39d7538d0f92623f7&amountIn=10000000000000000000000&tokenOut=0x4c9edd5852cd905f086c759e8383e09bff1e68b3&enableAggregator=true",
        )
        .reply(200, {
          method: "redeemPyToToken",
          contractCallParamsName: ["receiver", "YT", "netPyIn", "output"],
          contractCallParams: [
            "0x767a702a317ecd9dd373048dd1a6a3eea8721169",
            "0x99c92d4da7a81c7698ef33a39d7538d0f92623f7",
            "10000000000000000000000",
            {
              tokenOut: "0x4c9edd5852cd905f086c759e8383e09bff1e68b3",
              minTokenOut: "9600000000000000000000",
              tokenRedeemSy: "0x4c9edd5852cd905f086c759e8383e09bff1e68b3",
              pendleSwap: "0x0000000000000000000000000000000000000000",
              swapData: [Object],
            },
          ],
          tx,
          tokenApprovals: [
            {
              token: "0x62c6e813b9589c3631ba0cdb013acdb8544038b7",
              amount: "10000000000000000000000",
            },
            {
              token: "0x99c92d4da7a81c7698ef33a39d7538d0f92623f7",
              amount: "10000000000000000000000",
            },
          ],
          data: { amountOut, priceImpact: -1.817e-16 },
        });

      await pendlePTVenue.convert(encoder, {
        src: collateral,
        dst: USDC,
        srcAmount: collateralAmount,
      });

      const encodedCalls = encoder.flush();

      expect(encodedCalls).toEqual(expectedCalls);

      await encoder.client.deal({
        erc20: collateral,
        account: encoder.address,
        amount: collateralAmount,
      });

      const [encoderCollateralBalanceBefore, encoderUnderlyingBalanceBefore] = await Promise.all([
        readContract(encoder.client, {
          address: collateral,
          abi: erc20Abi,
          functionName: "balanceOf",
          args: [encoder.address],
        }),
        readContract(encoder.client, {
          address: underlying,
          abi: erc20Abi,
          functionName: "balanceOf",
          args: [encoder.address],
        }),
      ]);

      expect(encoderCollateralBalanceBefore).toBe(collateralAmount);
      expect(encoderUnderlyingBalanceBefore).toBe(0n);

      const functionData = {
        abi: executorAbi,
        functionName: "exec_606BaXt",
        args: [encodedCalls],
      } as const;

      await writeContract(encoder.client, { address: encoder.address, ...functionData });

      const [encoderCollateralBalanceAfter, encoderUnderlyingBalanceAfter] = await Promise.all([
        readContract(encoder.client, {
          address: collateral,
          abi: erc20Abi,
          functionName: "balanceOf",
          args: [encoder.address],
        }),
        readContract(encoder.client, {
          address: underlying,
          abi: erc20Abi,
          functionName: "balanceOf",
          args: [encoder.address],
        }),
      ]);

      expect(encoderCollateralBalanceAfter).toBe(0n);
      expect(encoderUnderlyingBalanceAfter).toBeGreaterThanOrEqual(BigInt(amountOut));
    },
  );
});

afterEach(() => {
  // restoring date after each test run
  vi.useRealTimers();
});
