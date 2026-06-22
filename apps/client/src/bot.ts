import { chainConfigs } from "@morpho-blue-liquidation-bot/config";
import type { DataProvider } from "@morpho-blue-liquidation-bot/data-providers";
import type { LiquidityVenue } from "@morpho-blue-liquidation-bot/liquidity-venues";
import type { Pricer } from "@morpho-blue-liquidation-bot/pricers";
import {
  AccrualPosition,
  ChainAddresses,
  getChainAddresses,
  type IMarketParams,
  MarketUtils,
  PreLiquidationPosition,
} from "@morpho-org/blue-sdk";
import { executorAbi } from "executooor-viem";
import {
  erc20Abi,
  formatUnits,
  getAddress,
  LocalAccount,
  maxUint256,
  parseUnits,
  type Account,
  type Address,
  type Chain,
  type Hex,
  type Transport,
  type WalletClient,
} from "viem";
import {
  getBlockNumber,
  getGasPrice,
  readContract,
  simulateCalls,
  writeContract,
} from "viem/actions";

import {
  MarketsFetchingCooldownMechanism,
  PositionLiquidationCooldownMechanism,
} from "./utils/cooldownMechanisms.js";
import { fetchWhitelistedVaults } from "./utils/fetch-whitelisted-vaults.js";
import { Flashbots } from "./utils/flashbots.js";
import { LiquidationEncoder } from "./utils/LiquidationEncoder.js";
import { DEFAULT_LIQUIDATION_BUFFER_BPS, WAD, wMulDown } from "./utils/maths.js";

export interface LiquidationBotInputs {
  logTag: string;
  chainId: number;
  client: WalletClient<Transport, Chain, Account>;
  wNative: Address;
  vaultWhitelist: Address[] | "morpho-api";
  additionalMarketsWhitelist: Hex[];
  executorAddress: Address;
  treasuryAddress: Address;
  dataProvider: DataProvider;
  liquidityVenues: LiquidityVenue[];
  alwaysRealizeBadDebt: boolean;
  pricers?: Pricer[];
  positionLiquidationCooldownMechanism?: PositionLiquidationCooldownMechanism;
  marketsFetchingCooldownMechanism: MarketsFetchingCooldownMechanism;
  flashbotAccount?: LocalAccount;
  /**
   * When set, enables partial liquidation: the bot tries candidate seize amounts
   * `seizableCollateral / 2^i` for i in [0, 10) from largest to smallest, skipping
   * any candidate whose collateral USD value is below this threshold (except a
   * full bad-debt seize, which is always tried). Submits the first profitable
   * candidate. Undefined disables the feature (single-attempt legacy behavior).
   */
  partialLiquidationMinSeizeUsd?: number;
}

export class LiquidationBot {
  private logTag: string;
  private chainId: number;
  private client: WalletClient<Transport, Chain, Account>;
  private chainAddresses: ChainAddresses;
  private wNative: Address;
  private vaultWhitelist: Address[] | "morpho-api";
  private additionalMarketsWhitelist: Hex[];
  private executorAddress: Address;
  private treasuryAddress: Address;
  private dataProvider: DataProvider;
  private liquidityVenues: LiquidityVenue[];
  private pricers?: Pricer[];
  private positionLiquidationCooldownMechanism?: PositionLiquidationCooldownMechanism;
  private marketsFetchingCooldownMechanism: MarketsFetchingCooldownMechanism;
  private flashbotAccount?: LocalAccount;
  private coveredMarkets: Hex[];
  private alwaysRealizeBadDebt: boolean;
  private partialLiquidationMinSeizeUsd?: number;

  constructor(inputs: LiquidationBotInputs) {
    this.logTag = inputs.logTag;
    this.chainId = inputs.chainId;
    this.client = inputs.client;
    this.chainAddresses = getChainAddresses(inputs.chainId);
    this.wNative = inputs.wNative;
    this.vaultWhitelist = inputs.vaultWhitelist;
    this.additionalMarketsWhitelist = inputs.additionalMarketsWhitelist;
    this.executorAddress = inputs.executorAddress;
    this.treasuryAddress = inputs.treasuryAddress;
    this.dataProvider = inputs.dataProvider;
    this.liquidityVenues = inputs.liquidityVenues;
    this.pricers = inputs.pricers;
    this.positionLiquidationCooldownMechanism = inputs.positionLiquidationCooldownMechanism;
    this.marketsFetchingCooldownMechanism = inputs.marketsFetchingCooldownMechanism;
    this.flashbotAccount = inputs.flashbotAccount;
    this.coveredMarkets = [];
    this.alwaysRealizeBadDebt = inputs.alwaysRealizeBadDebt;
    this.partialLiquidationMinSeizeUsd = inputs.partialLiquidationMinSeizeUsd;
  }

  async run() {
    await this.fetchMarkets();

    const { liquidatablePositions, preLiquidatablePositions } =
      await this.dataProvider.fetchLiquidatablePositions(this.client, this.coveredMarkets);

    await Promise.all([
      ...liquidatablePositions.map((position) => this.liquidate(position)),
      ...preLiquidatablePositions.map((position) => this.preLiquidate(position)),
    ]);
  }

  private async liquidate(position: AccrualPosition) {
    const marketParams = position.market.params;
    const fullSeizableCollateral = position.seizableCollateral ?? 0n;

    if (!this.checkCooldown(MarketUtils.getMarketId(marketParams), position.user)) return;

    const candidates =
      this.partialLiquidationMinSeizeUsd === undefined
        ? [fullSeizableCollateral]
        : await this.partialLiquidationCandidates(
            marketParams.collateralToken,
            fullSeizableCollateral,
            position.collateral,
            this.partialLiquidationMinSeizeUsd,
          );

    for (const seizableCollateral of candidates) {
      const badDebtPosition = seizableCollateral === position.collateral;
      const submitted = await this.attemptLiquidation(
        position.user,
        marketParams,
        seizableCollateral,
        badDebtPosition,
      );
      if (submitted) return;
    }
  }

  private async attemptLiquidation(
    user: Address,
    marketParams: IMarketParams,
    seizableCollateral: bigint,
    badDebtPosition: boolean,
  ): Promise<boolean> {
    const { client, executorAddress } = this;
    const encoder = new LiquidationEncoder(executorAddress, client);

    if (
      !(await this.convertCollateralToLoan(
        marketParams,
        this.decreaseSeizableCollateral(seizableCollateral, badDebtPosition),
        encoder,
      ))
    )
      return false;

    encoder.erc20Approve(marketParams.loanToken, this.chainAddresses.morpho, maxUint256);

    encoder.morphoBlueLiquidate(
      this.chainAddresses.morpho,
      {
        loanToken: marketParams.loanToken,
        collateralToken: marketParams.collateralToken,
        oracle: marketParams.oracle,
        irm: marketParams.irm,
        lltv: BigInt(marketParams.lltv),
      },
      user,
      seizableCollateral,
      0n,
      encoder.flush(),
    );
    encoder.erc20Skim(marketParams.loanToken, this.treasuryAddress);

    const calls = encoder.flush();

    try {
      const success = await this.handleTx(encoder, calls, marketParams, badDebtPosition);

      if (success)
        console.log(
          `${this.logTag}Liquidated ${user} on ${MarketUtils.getMarketId(marketParams)} (seized ${seizableCollateral})`,
        );
      else
        console.log(
          `${this.logTag}ℹ️ Skipped ${user} on ${MarketUtils.getMarketId(marketParams)} (not profitable, seize ${seizableCollateral})`,
        );

      return Boolean(success);
    } catch (error) {
      console.error(
        `${this.logTag}Failed to liquidate ${user} on ${MarketUtils.getMarketId(marketParams)} (seize ${seizableCollateral})`,
        error,
      );
      return false;
    }
  }

  private async preLiquidate(position: PreLiquidationPosition) {
    const marketParams = position.market.params;
    const fullSeizableCollateral = position.seizableCollateral ?? 0n;

    if (!this.checkCooldown(MarketUtils.getMarketId(marketParams), position.user)) return;

    const candidates =
      this.partialLiquidationMinSeizeUsd === undefined
        ? [fullSeizableCollateral]
        : await this.partialLiquidationCandidates(
            marketParams.collateralToken,
            fullSeizableCollateral,
            position.collateral,
            this.partialLiquidationMinSeizeUsd,
          );

    for (const seizableCollateral of candidates) {
      const submitted = await this.attemptPreLiquidation(
        position,
        marketParams,
        this.decreaseSeizableCollateral(seizableCollateral, false),
      );
      if (submitted) return;
    }
  }

  private async attemptPreLiquidation(
    position: PreLiquidationPosition,
    marketParams: IMarketParams,
    seizableCollateral: bigint,
  ): Promise<boolean> {
    const { client, executorAddress } = this;
    const encoder = new LiquidationEncoder(executorAddress, client);

    if (!(await this.convertCollateralToLoan(marketParams, seizableCollateral, encoder)))
      return false;

    encoder.erc20Approve(marketParams.loanToken, position.preLiquidation, maxUint256);

    encoder.preLiquidate(
      position.preLiquidation,
      position.user,
      seizableCollateral,
      0n,
      encoder.flush(),
    );
    encoder.erc20Skim(marketParams.loanToken, this.treasuryAddress);

    const calls = encoder.flush();

    try {
      const success = await this.handleTx(encoder, calls, marketParams, false);

      if (success)
        console.log(
          `${this.logTag}Pre-liquidated ${position.user} on ${MarketUtils.getMarketId(marketParams)} (seized ${seizableCollateral})`,
        );
      else
        console.log(
          `${this.logTag}ℹ️ Skipped ${position.user} on ${MarketUtils.getMarketId(marketParams)} (not profitable, seize ${seizableCollateral})`,
        );

      return Boolean(success);
    } catch (error) {
      console.error(
        `${this.logTag}Failed to pre-liquidate ${position.user} on ${MarketUtils.getMarketId(marketParams)} (seize ${seizableCollateral})`,
        error,
      );
      return false;
    }
  }

  /**
   * Builds the list of seize-amount candidates to try, from largest to smallest:
   * `seizableCollateral / 2^i` for i in [0, 10). Filters out duplicates and zero,
   * and drops candidates whose collateral USD value is below `minSeizeUsd` unless
   * the candidate equals `positionCollateral` (i.e., full bad-debt realization).
   * If no pricers are configured, the USD filter is skipped (all candidates kept).
   */
  private async partialLiquidationCandidates(
    collateralToken: Address,
    seizableCollateral: bigint,
    positionCollateral: bigint,
    minSeizeUsd: number,
  ): Promise<bigint[]> {
    const raw = Array.from({ length: 10 }, (_, i) => seizableCollateral / (1n << BigInt(i))).filter(
      (amount, index, arr) => amount > 0n && arr.indexOf(amount) === index,
    );

    if (this.pricers === undefined || this.pricers.length === 0) return raw;

    const kept: bigint[] = [];
    for (const candidate of raw) {
      if (candidate === positionCollateral) {
        kept.push(candidate);
        continue;
      }
      const usdValue = await this.price(collateralToken, candidate, this.pricers);
      if (usdValue !== undefined && usdValue >= minSeizeUsd) kept.push(candidate);
    }
    return kept;
  }

  private async handleTx(
    encoder: LiquidationEncoder,
    calls: Hex[],
    marketParams: IMarketParams,
    badDebtPosition: boolean,
  ) {
    const functionData = {
      abi: executorAbi,
      functionName: "exec_606BaXt",
      args: [calls],
    } as const;

    const [{ results }, gasPrice] = await Promise.all([
      simulateCalls(this.client, {
        account: this.client.account.address,
        calls: [
          {
            to: marketParams.loanToken,
            abi: erc20Abi,
            functionName: "balanceOf",
            args: [this.client.account.address],
          },
          { to: encoder.address, ...functionData },
          {
            to: marketParams.loanToken,
            abi: erc20Abi,
            functionName: "balanceOf",
            args: [this.client.account.address],
          },
        ],
      }),
      getGasPrice(this.client),
    ]);

    if (results[1].status !== "success") {
      console.warn(`${this.logTag}Transaction failed in simulation: ${results[1].error}`);
      return;
    }

    if (
      !(await this.checkProfit(
        marketParams.loanToken,
        {
          beforeTx: results[0].result,
          afterTx: results[2].result,
        },
        {
          used: results[1].gasUsed,
          price: gasPrice,
        },
        badDebtPosition,
      ))
    )
      return false;

    // TX EXECUTION

    if (this.flashbotAccount) {
      const signedBundle = await Flashbots.signBundle([
        {
          transaction: { to: encoder.address, ...functionData },
          client: this.client,
        },
      ]);

      await Flashbots.sendRawBundle(
        signedBundle,
        (await getBlockNumber(this.client)) + 1n,
        this.flashbotAccount,
      );
      return true;
    } else {
      await writeContract(this.client, { address: encoder.address, ...functionData });
    }

    return true;
  }

  private async convertCollateralToLoan(
    marketParams: IMarketParams,
    seizableCollateral: bigint,
    encoder: LiquidationEncoder,
  ) {
    let toConvert = {
      src: getAddress(marketParams.collateralToken),
      dst: getAddress(marketParams.loanToken),
      srcAmount: seizableCollateral,
    };

    for (const venue of this.liquidityVenues) {
      try {
        if (await venue.supportsRoute(encoder, toConvert.src, toConvert.dst))
          toConvert = await venue.convert(encoder, toConvert);
      } catch (error) {
        console.error(`${this.logTag}Error converting ${toConvert.src} to ${toConvert.dst}`, error);
        continue;
      }

      if (toConvert.src === toConvert.dst) return true;
    }

    return false;
  }

  private async price(asset: Address, amount: bigint, pricers: Pricer[]) {
    let price: number | undefined = undefined;

    for (const pricer of pricers) {
      price = await pricer.price(this.client, asset);
      if (price !== undefined) break;
    }

    if (price === undefined) return undefined;

    const decimals =
      asset === this.wNative
        ? 18
        : await readContract(this.client, {
            address: asset,
            abi: erc20Abi,
            functionName: "decimals",
          });

    return parseFloat(formatUnits(amount, decimals)) * price;
  }

  private async checkProfit(
    loanAsset: Address,
    loanAssetBalance: {
      beforeTx: bigint | undefined;
      afterTx: bigint | undefined;
    },
    gas: {
      used: bigint;
      price: bigint;
    },
    badDebtPosition: boolean,
  ) {
    if (this.alwaysRealizeBadDebt && badDebtPosition) return true;
    if (this.pricers === undefined || this.pricers.length === 0) return true;

    if (loanAssetBalance.beforeTx === undefined || loanAssetBalance.afterTx === undefined)
      return false;

    const loanAssetProfit = loanAssetBalance.afterTx - loanAssetBalance.beforeTx;

    if (loanAssetProfit <= 0n) return false;

    const [loanAssetProfitUsd, gasUsedUsd] = await Promise.all([
      this.price(loanAsset, loanAssetProfit, this.pricers),
      this.price(this.wNative, gas.used * gas.price, this.pricers),
    ]);

    if (loanAssetProfitUsd === undefined || gasUsedUsd === undefined) return false;

    const profitUsd = loanAssetProfitUsd - gasUsedUsd;

    return profitUsd > 0;
  }

  private decreaseSeizableCollateral(seizableCollateral: bigint, badDebtPosition: boolean) {
    if (badDebtPosition) return seizableCollateral;

    const liquidationBufferBps =
      chainConfigs[this.chainId]?.options.liquidationBufferBps ?? DEFAULT_LIQUIDATION_BUFFER_BPS;

    return wMulDown(seizableCollateral, WAD - parseUnits(liquidationBufferBps.toString(), 14));
  }

  private checkCooldown(marketId: Hex, account: Address) {
    if (
      this.positionLiquidationCooldownMechanism !== undefined &&
      !this.positionLiquidationCooldownMechanism.isPositionReady(marketId, account)
    ) {
      return false;
    }
    return true;
  }

  private async fetchMarkets() {
    if (!this.marketsFetchingCooldownMechanism.isFetchingReady()) return;

    if (this.vaultWhitelist === "morpho-api")
      this.vaultWhitelist = await fetchWhitelistedVaults(this.chainId);

    const vaultWhitelist = this.vaultWhitelist;
    console.log(`${this.logTag}📝 Watching markets in the following vaults:`, vaultWhitelist);

    const whitelistedMarketsFromVaults = await this.dataProvider.fetchMarkets(
      this.client,
      vaultWhitelist,
    );

    this.coveredMarkets = [...whitelistedMarketsFromVaults, ...this.additionalMarketsWhitelist];
  }
}
