import { midasConfigs } from "@morpho-blue-liquidation-bot/config";
import { type ExecutorEncoder } from "executooor-viem";
import { type Address, encodeFunctionData, erc20Abi } from "viem";
import { readContract } from "viem/actions";

import type { ToConvert } from "../../utils/types";
import type { LiquidityVenue } from "../liquidityVenue";
import { PreviewRedeemInstantParams } from "./types";
import { midasDataFeedAbi, redemptionVaultAbi } from "../../abis/midas";
import { MathLib } from "@morpho-org/blue-sdk";

const ONE_HUNDRED_PERCENT = 100n * 100n;

export class MidasVenue implements LiquidityVenue {
  supportsRoute(encoder: ExecutorEncoder, src: Address, dst: Address) {
    if (src === dst) return false;

    return this.isMidasToken(src, encoder.client.chain.id);
  }

  async convert(encoder: ExecutorEncoder, toConvert: ToConvert) {
    const { src, dst, srcAmount } = toConvert;

    const tokenOut = this.postRedeemToken(src, encoder.client.chain.id, dst);

    const redemptionVault = this.redemptionVault(src, encoder.client.chain.id);

    const redemptionParams = await this.getRedemptionParams(
      redemptionVault,
      tokenOut,
      srcAmount,
      encoder,
    );

    if (!redemptionParams) return toConvert;

    const previewRedeemInstantData = this.previewRedeemInstant(redemptionParams);

    if (!previewRedeemInstantData) {
      return toConvert;
    }

    const { amountTokenOutWithoutFee, feeAmount } = previewRedeemInstantData;

    if (feeAmount > 0n) {
      encoder.erc20Approve(src, redemptionVault, feeAmount);
    }

    encoder.pushCall(
      redemptionVault,
      0n,
      encodeFunctionData({
        abi: redemptionVaultAbi,
        functionName: "redeemInstant",
        args: [tokenOut, srcAmount, amountTokenOutWithoutFee],
      }),
    );

    return {
      src: tokenOut,
      srcAmount: this._convertFromBase18(
        amountTokenOutWithoutFee,
        redemptionParams.tokenOutDecimals,
      ),
      dst: dst,
    };
  }

  private isMidasToken(token: Address, chainId: number) {
    return Object.keys(midasConfigs[chainId] ?? {}).some((tokenAddress) => tokenAddress === token);
  }

  private postRedeemToken(token: Address, chainId: number, dst: Address) {
    const redeemTokens = midasConfigs[chainId]![token]!.redemptionAssets;
    return redeemTokens.includes(dst) ? dst : redeemTokens[0]!;
  }

  private redemptionVault(token: Address, chainId: number) {
    return midasConfigs[chainId]![token]!.instantRedemptionVault;
  }

  private previewRedeemInstant(params: PreviewRedeemInstantParams) {
    const feeData = this._calcAndValidateRedeem(params);
    if (!feeData) return undefined;

    if (!this._requireAndUpdateLimit(params, feeData.amountMTokenWithoutFee)) return undefined;

    const usdData = this._convertMTokenToUsd(params, feeData.amountMTokenWithoutFee);

    if (!usdData) return undefined;

    const tokenData = this._convertUsdToToken(params, usdData.amountUsd);

    if (!tokenData) return undefined;

    return {
      amountTokenOutWithoutFee: this._truncate(
        (feeData.amountMTokenWithoutFee * usdData.mTokenRate) / tokenData.tokenRate,
        params.tokenOutDecimals,
      ),
      feeAmount: feeData.feeAmount,
    };
  }

  private _calcAndValidateRedeem(params: PreviewRedeemInstantParams) {
    if (params.minAmount > params.amountMTokenIn) return undefined;

    const feeAmount = this._getFeeAmount(params);

    return params.amountMTokenIn > feeAmount
      ? { feeAmount, amountMTokenWithoutFee: params.amountMTokenIn - feeAmount }
      : undefined;
  }

  private _getFeeAmount(params: PreviewRedeemInstantParams) {
    if (params.waivedFeeRestriction) return 0n;

    const feePercent = MathLib.min(
      params.tokenOutConfig.fee + params.instantFee,
      ONE_HUNDRED_PERCENT,
    );

    return (params.amountMTokenIn * feePercent) / ONE_HUNDRED_PERCENT;
  }

  private _requireAndUpdateLimit(params: PreviewRedeemInstantParams, amount: bigint) {
    return params.dailyLimits + amount <= params.instantDailyLimit;
  }

  private _convertMTokenToUsd(params: PreviewRedeemInstantParams, amount: bigint) {
    if (amount === 0n || params.mTokenRate === 0n) return undefined;

    return {
      amountUsd: (amount * params.mTokenRate) / 10n ** 18n,
      mTokenRate: params.mTokenRate,
    };
  }

  private _convertUsdToToken(params: PreviewRedeemInstantParams, amountUsd: bigint) {
    if (amountUsd === 0n) return undefined;

    const tokenRate = params.tokenOutConfig.stable ? params.STABLECOIN_RATE : params.tokenOutRate;

    if (tokenRate === 0n) return undefined;

    return {
      amountToken: (amountUsd * 10n ** 18n) / tokenRate,
      tokenRate,
    };
  }

  private _truncate(value: bigint, decimals: bigint) {
    return this._convertToBase18(this._convertFromBase18(value, decimals), decimals);
  }

  private _convertFromBase18(originalAmount: bigint, decidedDecimals: bigint) {
    return this._convert(originalAmount, 18n, decidedDecimals);
  }

  private _convertToBase18(originalAmount: bigint, originalDecimals: bigint) {
    return this._convert(originalAmount, originalDecimals, 18n);
  }

  private _convert(originalAmount: bigint, originalDecimals: bigint, decidedDecimals: bigint) {
    if (originalAmount === 0n) return 0n;
    if (originalDecimals === decidedDecimals) return originalAmount;

    let adjustedAmount = 0n;

    if (originalDecimals > decidedDecimals) {
      adjustedAmount = originalAmount / 10n ** (originalDecimals - decidedDecimals);
    } else {
      adjustedAmount = originalAmount * 10n ** (decidedDecimals - originalDecimals);
    }

    return adjustedAmount;
  }

  // async methods

  private async getRedemptionParams(
    vault: Address,
    tokenOut: Address,
    seizedCollateral: bigint,
    encoder: ExecutorEncoder,
  ): Promise<PreviewRedeemInstantParams | undefined> {
    try {
      const [
        minAmount,
        instantFee,
        instantDailyLimit,
        STABLECOIN_RATE,
        waivedFeeRestriction,
        dailyLimits,
        mTokenDataFeed,
        tokenOutConfig,
        tokenOutDecimals,
      ] = await Promise.all([
        this.getRedemptionVaultMinAmount(vault, encoder),
        this.getRedemptionVaultInstantFee(vault, encoder),
        this.getRedemptionVaultInstantDailyLimit(vault, encoder),
        this.getRedemptionVaultStableCoinRate(vault, encoder),
        this.getRedemptionVaultWaivedFeeRestriction(vault, encoder),
        this.getRedemptionVaultDailyLimits(vault, encoder),
        this.getRedemptionVaultmTokenDataFeed(vault, encoder),
        this.getRedemptionVaultMTokenOutConfig(vault, tokenOut, encoder),
        readContract(encoder.client, {
          address: tokenOut,
          abi: erc20Abi,
          functionName: "decimals",
          args: [],
        }),
      ]);

      const [mTokenRate, tokenOutRate] = await Promise.all([
        this.getMidasRate(mTokenDataFeed, encoder),
        this.getMidasRate(tokenOutConfig[0], encoder),
      ]);

      return {
        amountMTokenIn: seizedCollateral,
        tokenOutConfig: {
          dataFeed: tokenOutConfig[0],
          fee: tokenOutConfig[1],
          allowance: tokenOutConfig[2],
          stable: tokenOutConfig[3],
        },
        tokenOutDecimals: BigInt(tokenOutDecimals),
        minAmount,
        instantFee,
        instantDailyLimit,
        STABLECOIN_RATE,
        waivedFeeRestriction,
        dailyLimits,
        mTokenRate,
        tokenOutRate,
      };
    } catch (e) {
      console.error(e);
      return undefined;
    }
  }

  async getRedemptionVaultMinAmount(vault: Address, encoder: ExecutorEncoder) {
    return readContract(encoder.client, {
      address: vault,
      abi: redemptionVaultAbi,
      functionName: "minAmount",
      args: [],
    });
  }

  async getRedemptionVaultInstantFee(vault: Address, encoder: ExecutorEncoder) {
    return readContract(encoder.client, {
      address: vault,
      abi: redemptionVaultAbi,
      functionName: "instantFee",
      args: [],
    });
  }

  async getRedemptionVaultInstantDailyLimit(vault: Address, encoder: ExecutorEncoder) {
    return readContract(encoder.client, {
      address: vault,
      abi: redemptionVaultAbi,
      functionName: "instantDailyLimit",
      args: [],
    });
  }

  async getRedemptionVaultStableCoinRate(vault: Address, encoder: ExecutorEncoder) {
    return readContract(encoder.client, {
      address: vault,
      abi: redemptionVaultAbi,
      functionName: "STABLECOIN_RATE",
      args: [],
    });
  }

  async getRedemptionVaultWaivedFeeRestriction(vault: Address, encoder: ExecutorEncoder) {
    return readContract(encoder.client, {
      address: vault,
      abi: redemptionVaultAbi,
      functionName: "waivedFeeRestriction",
      args: [encoder.address],
    });
  }

  async getRedemptionVaultDailyLimits(vault: Address, encoder: ExecutorEncoder) {
    const currentDayNumber = Math.round(Date.now() / 1000 / (60 * 60 * 24));
    return readContract(encoder.client, {
      address: vault,
      abi: redemptionVaultAbi,
      functionName: "dailyLimits",
      args: [BigInt(currentDayNumber)],
    });
  }

  async getRedemptionVaultmTokenDataFeed(vault: Address, encoder: ExecutorEncoder) {
    return readContract(encoder.client, {
      address: vault,
      abi: redemptionVaultAbi,
      functionName: "mTokenDataFeed",
      args: [],
    });
  }

  async getRedemptionVaultMTokenOutConfig(
    vault: Address,
    tokenOutAddress: Address,
    encoder: ExecutorEncoder,
  ) {
    return readContract(encoder.client, {
      address: vault,
      abi: redemptionVaultAbi,
      functionName: "tokensConfig",
      args: [tokenOutAddress],
    });
  }

  async getMidasRate(dataFeed: Address, encoder: ExecutorEncoder) {
    return readContract(encoder.client, {
      address: dataFeed,
      abi: midasDataFeedAbi,
      functionName: "getDataInBase18",
      args: [],
    });
  }

  async getRedemptionVaultPaymentTokens(vault: Address) {
    return readContract(this.client, {
      address: vault,
      abi: redemptionVaultAbi,
      functionName: "getPaymentTokens",
      args: [],
    });
  }
}
