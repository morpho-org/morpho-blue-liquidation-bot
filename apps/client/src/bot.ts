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
   * Per-loan-asset minimum borrow-assets threshold (in loan-asset atoms). The
   * threshold acts as a position-level mode switch:
   *
   * - Loan asset missing from this submap → single full-seize attempt (legacy).
   * - Loan asset present, `position.borrowAssets < threshold` → single full-seize
   *   attempt (regardless of bad-debt status).
   * - Loan asset present, `position.borrowAssets >= threshold` → partial mode:
   *   the bot simulates candidate seize amounts `seizableCollateral / 2^i` for
   *   i in [0, 10) and submits the candidate with the largest seize amount
   *   among the profitable simulations.
   *
   * This is the per-chain submap from `partialLiquidationMinRepay` in the
   * config package — the launcher slices it by `config.chainId`.
   */
  partialLiquidationMinRepay?: Partial<Record<Address, bigint>>;
}

interface PreparedLiquidation {
  encoder: LiquidationEncoder;
  calls: Hex[];
  profitable: boolean;
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
  private partialLiquidationMinRepay?: Partial<Record<Address, bigint>>;

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
    this.partialLiquidationMinRepay = inputs.partialLiquidationMinRepay;
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

    if (!this.partialLiquidationEnabledFor(marketParams.loanToken, position.borrowAssets)) {
      // Loan asset not configured, or position's borrow assets are below the threshold:
      // single full-seize attempt regardless of bad-debt status.
      await this.runSingleLiquidationAttempt(
        position.user,
        marketParams,
        fullSeizableCollateral,
        fullSeizableCollateral === position.collateral,
      );
      return;
    }

    // Partial liquidation: simulate every halving candidate, keep the profitable ones,
    // submit the candidate with the largest seize amount.
    const candidates = this.partialLiquidationCandidates(fullSeizableCollateral);

    const successes: { seizableCollateral: bigint; prepared: PreparedLiquidation }[] = [];
    for (const seizableCollateral of candidates) {
      const badDebtPosition = seizableCollateral === position.collateral;
      const prepared = await this.prepareLiquidation(
        position.user,
        marketParams,
        seizableCollateral,
        badDebtPosition,
      );
      if (prepared?.profitable) successes.push({ seizableCollateral, prepared });
    }

    if (successes.length === 0) return;

    const winner = successes.reduce((a, b) =>
      a.seizableCollateral > b.seizableCollateral ? a : b,
    );

    try {
      await this.sendLiquidationTx(winner.prepared);
      console.log(
        `${this.logTag}Liquidated ${position.user} on ${MarketUtils.getMarketId(marketParams)} (seized ${winner.seizableCollateral}, biggest of ${successes.length} profitable candidate(s))`,
      );
    } catch (error) {
      console.error(
        `${this.logTag}Failed to liquidate ${position.user} on ${MarketUtils.getMarketId(marketParams)} (seize ${winner.seizableCollateral})`,
        error,
      );
    }
  }

  private async runSingleLiquidationAttempt(
    user: Address,
    marketParams: IMarketParams,
    seizableCollateral: bigint,
    badDebtPosition: boolean,
  ) {
    const prepared = await this.prepareLiquidation(
      user,
      marketParams,
      seizableCollateral,
      badDebtPosition,
    );

    if (prepared === null) return;

    if (!prepared.profitable) {
      console.log(
        `${this.logTag}ℹ️ Skipped ${user} on ${MarketUtils.getMarketId(marketParams)} (not profitable, seize ${seizableCollateral})`,
      );
      return;
    }

    try {
      await this.sendLiquidationTx(prepared);
      console.log(
        `${this.logTag}Liquidated ${user} on ${MarketUtils.getMarketId(marketParams)} (seized ${seizableCollateral})`,
      );
    } catch (error) {
      console.error(
        `${this.logTag}Failed to liquidate ${user} on ${MarketUtils.getMarketId(marketParams)} (seize ${seizableCollateral})`,
        error,
      );
    }
  }

  private async prepareLiquidation(
    user: Address,
    marketParams: IMarketParams,
    seizableCollateral: bigint,
    badDebtPosition: boolean,
  ): Promise<PreparedLiquidation | null> {
    const { client, executorAddress } = this;
    const encoder = new LiquidationEncoder(executorAddress, client);

    if (
      !(await this.convertCollateralToLoan(
        marketParams,
        this.decreaseSeizableCollateral(seizableCollateral, badDebtPosition),
        encoder,
      ))
    )
      return null;

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

    const profitable = await this.simulateAndCheckProfit(
      encoder,
      calls,
      marketParams,
      badDebtPosition,
    );
    if (profitable === undefined) return null;

    return { encoder, calls, profitable };
  }

  private async preLiquidate(position: PreLiquidationPosition) {
    const marketParams = position.market.params;
    const fullSeizableCollateral = position.seizableCollateral ?? 0n;

    if (!this.checkCooldown(MarketUtils.getMarketId(marketParams), position.user)) return;

    if (!this.partialLiquidationEnabledFor(marketParams.loanToken, position.borrowAssets)) {
      await this.runSinglePreLiquidationAttempt(
        position,
        marketParams,
        this.decreaseSeizableCollateral(fullSeizableCollateral, false),
      );
      return;
    }

    const candidates = this.partialLiquidationCandidates(fullSeizableCollateral);

    const successes: { seizableCollateral: bigint; prepared: PreparedLiquidation }[] = [];
    for (const seizableCollateral of candidates) {
      const adjusted = this.decreaseSeizableCollateral(seizableCollateral, false);
      const prepared = await this.preparePreLiquidation(position, marketParams, adjusted);
      if (prepared?.profitable) successes.push({ seizableCollateral: adjusted, prepared });
    }

    if (successes.length === 0) return;

    const winner = successes.reduce((a, b) =>
      a.seizableCollateral > b.seizableCollateral ? a : b,
    );

    try {
      await this.sendLiquidationTx(winner.prepared);
      console.log(
        `${this.logTag}Pre-liquidated ${position.user} on ${MarketUtils.getMarketId(marketParams)} (seized ${winner.seizableCollateral}, biggest of ${successes.length} profitable candidate(s))`,
      );
    } catch (error) {
      console.error(
        `${this.logTag}Failed to pre-liquidate ${position.user} on ${MarketUtils.getMarketId(marketParams)} (seize ${winner.seizableCollateral})`,
        error,
      );
    }
  }

  private async runSinglePreLiquidationAttempt(
    position: PreLiquidationPosition,
    marketParams: IMarketParams,
    seizableCollateral: bigint,
  ) {
    const prepared = await this.preparePreLiquidation(position, marketParams, seizableCollateral);

    if (prepared === null) return;

    if (!prepared.profitable) {
      console.log(
        `${this.logTag}ℹ️ Skipped ${position.user} on ${MarketUtils.getMarketId(marketParams)} (not profitable, seize ${seizableCollateral})`,
      );
      return;
    }

    try {
      await this.sendLiquidationTx(prepared);
      console.log(
        `${this.logTag}Pre-liquidated ${position.user} on ${MarketUtils.getMarketId(marketParams)} (seized ${seizableCollateral})`,
      );
    } catch (error) {
      console.error(
        `${this.logTag}Failed to pre-liquidate ${position.user} on ${MarketUtils.getMarketId(marketParams)} (seize ${seizableCollateral})`,
        error,
      );
    }
  }

  private async preparePreLiquidation(
    position: PreLiquidationPosition,
    marketParams: IMarketParams,
    seizableCollateral: bigint,
  ): Promise<PreparedLiquidation | null> {
    const { client, executorAddress } = this;
    const encoder = new LiquidationEncoder(executorAddress, client);

    if (!(await this.convertCollateralToLoan(marketParams, seizableCollateral, encoder)))
      return null;

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

    const profitable = await this.simulateAndCheckProfit(encoder, calls, marketParams, false);
    if (profitable === undefined) return null;

    return { encoder, calls, profitable };
  }

  /**
   * Returns true iff this loan asset is configured for partial liquidation on this
   * chain AND the position's outstanding borrow assets are at or above the threshold.
   * The threshold acts as a position-level mode switch: smaller positions are always
   * liquidated in a single full attempt (regardless of bad-debt status); larger ones
   * go through the candidate-and-pick-biggest path.
   */
  private partialLiquidationEnabledFor(loanToken: Address, positionBorrowAssets: bigint): boolean {
    const minRepay = this.partialLiquidationMinRepay?.[getAddress(loanToken)];
    if (minRepay === undefined) return false;
    return positionBorrowAssets >= minRepay;
  }

  /**
   * Builds the list of seize-amount candidates to try, from largest to smallest:
   * `seizableCollateral / 2^i` for i in [0, 10). Deduped, zero-stripped.
   */
  private partialLiquidationCandidates(seizableCollateral: bigint): bigint[] {
    return Array.from({ length: 10 }, (_, i) => seizableCollateral / (1n << BigInt(i))).filter(
      (amount, index, arr) => amount > 0n && arr.indexOf(amount) === index,
    );
  }

  /**
   * Simulates the full executor call, then runs the profitability check.
   * Returns `true` if profitable (or unconditionally on bad-debt + `alwaysRealizeBadDebt`),
   * `false` if simulation succeeded but not profitable, `undefined` if simulation reverted.
   */
  private async simulateAndCheckProfit(
    encoder: LiquidationEncoder,
    calls: Hex[],
    marketParams: IMarketParams,
    badDebtPosition: boolean,
  ): Promise<boolean | undefined> {
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
      return undefined;
    }

    return this.checkProfit(
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
    );
  }

  private async sendLiquidationTx(prepared: PreparedLiquidation): Promise<void> {
    const functionData = {
      abi: executorAbi,
      functionName: "exec_606BaXt",
      args: [prepared.calls],
    } as const;

    if (this.flashbotAccount) {
      const signedBundle = await Flashbots.signBundle([
        {
          transaction: { to: prepared.encoder.address, ...functionData },
          client: this.client,
        },
      ]);

      await Flashbots.sendRawBundle(
        signedBundle,
        (await getBlockNumber(this.client)) + 1n,
        this.flashbotAccount,
      );
      return;
    }

    await writeContract(this.client, { address: prepared.encoder.address, ...functionData });
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
