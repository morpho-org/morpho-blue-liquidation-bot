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
  simulateContract,
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
import type { TelegramNotifier } from "./utils/telegram.js";

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
  notifier?: TelegramNotifier;
  marketsFetchingCooldownMechanism: MarketsFetchingCooldownMechanism;
  flashbotAccount?: LocalAccount;
  disableSimulateCalls?: boolean;
  minLiquidationValueUsd?: number;
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
  private notifier?: TelegramNotifier;
  private marketsFetchingCooldownMechanism: MarketsFetchingCooldownMechanism;
  private flashbotAccount?: LocalAccount;
  private disableSimulateCalls: boolean;
  private minLiquidationValueUsd?: number;
  private coveredMarkets: Hex[];
  private alwaysRealizeBadDebt: boolean;

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
    this.notifier = inputs.notifier;
    this.marketsFetchingCooldownMechanism = inputs.marketsFetchingCooldownMechanism;
    this.flashbotAccount = inputs.flashbotAccount;
    this.disableSimulateCalls = inputs.disableSimulateCalls ?? false;
    this.minLiquidationValueUsd = inputs.minLiquidationValueUsd;
    this.coveredMarkets = [];
    this.alwaysRealizeBadDebt = inputs.alwaysRealizeBadDebt;
  }

  async run() {
    try {
      await this.fetchMarkets();

      const { liquidatablePositions, preLiquidatablePositions } =
        await this.dataProvider.fetchLiquidatablePositions(this.client, this.coveredMarkets);

      await Promise.all([
        ...liquidatablePositions.map((position) => this.liquidate(position)),
        ...preLiquidatablePositions.map((position) => this.preLiquidate(position)),
      ]);
    } catch (error) {
      console.error(`${this.logTag}Error in run():`, error);
    }
  }

  private async liquidate(position: AccrualPosition) {
    const marketParams = position.market.params;
    const seizableCollateral = position.seizableCollateral ?? 0n;
    const badDebtPosition = seizableCollateral === position.collateral;

    if (badDebtPosition && !this.alwaysRealizeBadDebt) return;

    if (!this.checkCooldown(MarketUtils.getMarketId(marketParams), position.user)) return;

    if (this.minLiquidationValueUsd !== undefined && this.pricers && this.pricers.length > 0) {
      const valueUsd = await this.price(
        getAddress(marketParams.collateralToken),
        this.decreaseSeizableCollateral(seizableCollateral, badDebtPosition),
        this.pricers,
      );
      if (valueUsd !== undefined && valueUsd < this.minLiquidationValueUsd) return;
    }

    const { client, executorAddress } = this;

    const encoder = new LiquidationEncoder(executorAddress, client);

    if (
      !(await this.convertCollateralToLoan(
        marketParams,
        this.decreaseSeizableCollateral(seizableCollateral, badDebtPosition),
        encoder,
      ))
    )
      return;

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
      position.user,
      seizableCollateral,
      0n,
      encoder.flush(),
    );
    encoder.erc20Skim(marketParams.loanToken, this.treasuryAddress);

    const calls = encoder.flush();

    try {
      const success = await this.handleTx(
        encoder,
        calls,
        marketParams,
        badDebtPosition,
        position.user,
        "liquidation",
      );

      if (success)
        console.log(
          `${this.logTag}Liquidated ${position.user} on ${MarketUtils.getMarketId(marketParams)}`,
        );
      else
        console.log(
          `${this.logTag}ℹ️ Skipped ${position.user} on ${MarketUtils.getMarketId(marketParams)} (not profitable)`,
        );
    } catch (error) {
      /// Fire-and-forget: never block the bot loop on a Telegram round-trip.
      void this.notifier?.liquidationFailed(
        this.chainId,
        MarketUtils.getMarketId(marketParams),
        position.user,
        (error as Error)?.message ?? "unknown error",
        "liquidation",
      );
      console.error(
        `${this.logTag}Failed to liquidate ${position.user} on ${MarketUtils.getMarketId(marketParams)}`,
        error,
      );
    }
  }

  private async preLiquidate(position: PreLiquidationPosition) {
    const marketParams = position.market.params;
    const seizableCollateral = this.decreaseSeizableCollateral(
      position.seizableCollateral ?? 0n,
      false,
    );

    if (!this.checkCooldown(MarketUtils.getMarketId(marketParams), position.user)) return;

    const { client, executorAddress } = this;

    const encoder = new LiquidationEncoder(executorAddress, client);

    if (!(await this.convertCollateralToLoan(marketParams, seizableCollateral, encoder))) return;

    /// Fire-and-forget: must not delay tx submission.
    void this.notifier?.liquidationDetected(
      this.chainId,
      MarketUtils.getMarketId(marketParams),
      position.user,
      marketParams.collateralToken,
      seizableCollateral.toString(),
      "pre-liquidation",
    );

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
      const success = await this.handleTx(
        encoder,
        calls,
        marketParams,
        false,
        position.user,
        "pre-liquidation",
      );

      if (success)
        console.log(
          `${this.logTag}Pre-liquidated ${position.user} on ${MarketUtils.getMarketId(marketParams)}`,
        );
      else
        console.log(
          `${this.logTag}ℹ️ Skipped ${position.user} on ${MarketUtils.getMarketId(marketParams)} (not profitable)`,
        );
    } catch (error) {
      void this.notifier?.liquidationFailed(
        this.chainId,
        MarketUtils.getMarketId(marketParams),
        position.user,
        (error as Error)?.message ?? "unknown error",
        "pre-liquidation",
      );
      console.error(
        `${this.logTag}Failed to pre-liquidate ${position.user} on ${MarketUtils.getMarketId(marketParams)}`,
        error,
      );
    }
  }

  private async handleTx(
    encoder: LiquidationEncoder,
    calls: Hex[],
    marketParams: IMarketParams,
    badDebtPosition: boolean,
    borrower: Address,
    type: "liquidation" | "pre-liquidation",
  ) {
    const functionData = {
      abi: executorAbi,
      functionName: "exec_606BaXt",
      args: [calls],
    } as const;

    let profitUsd: number | undefined = undefined;

    if (this.disableSimulateCalls) {
      // eth_simulateV1 not supported: validate via eth_call and skip profit check
      await simulateContract(this.client, { address: encoder.address, ...functionData });
    } else {
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
        const reason = results[1].error ?? "simulation failure";
        console.warn(`${this.logTag}Transaction failed in simulation: ${reason}`);
        void this.notifier?.liquidationFailed(
          this.chainId,
          MarketUtils.getMarketId(marketParams),
          this.client.account.address,
          reason,
          badDebtPosition ? "pre-liquidation" : "liquidation",
        );
        return false;
      }

      const profitCheck = await this.checkProfit(
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

      if (!profitCheck.success) {
        void this.notifier?.liquidationFailed(
          this.chainId,
          MarketUtils.getMarketId(marketParams),
          borrower,
          profitCheck.reason ?? "not profitable",
          type,
        );
        return false;
      }

      profitUsd = profitCheck.profitUsd;
    }

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

      void this.notifier?.liquidationExecuted(
        this.chainId,
        MarketUtils.getMarketId(marketParams),
        borrower,
        profitUsd,
        undefined,
        type,
      );
    } else {
      const txHash = await writeContract(this.client, {
        address: encoder.address,
        ...functionData,
      });
      void this.notifier?.liquidationExecuted(
        this.chainId,
        MarketUtils.getMarketId(marketParams),
        borrower,
        profitUsd,
        txHash as string,
        type,
      );
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
    if (this.alwaysRealizeBadDebt && badDebtPosition) {
      return { success: true as const, profitUsd: undefined };
    }
    if (this.pricers === undefined || this.pricers.length === 0) {
      return { success: true as const, profitUsd: undefined };
    }

    if (loanAssetBalance.beforeTx === undefined || loanAssetBalance.afterTx === undefined) {
      return { success: false as const, reason: "missing balance data" };
    }

    const loanAssetProfit = loanAssetBalance.afterTx - loanAssetBalance.beforeTx;
    if (loanAssetProfit <= 0n)
      return { success: false as const, reason: "zero or negative profit" };

    const [loanAssetProfitUsd, gasUsedUsd] = await Promise.all([
      this.price(loanAsset, loanAssetProfit, this.pricers),
      this.price(this.wNative, gas.used * gas.price, this.pricers),
    ]);

    if (loanAssetProfitUsd === undefined || gasUsedUsd === undefined) {
      return { success: false as const, reason: "pricing unavailable" };
    }

    const profitUsd = loanAssetProfitUsd - gasUsedUsd;
    if (profitUsd <= 0) return { success: false as const, reason: "not profitable after gas" };

    return { success: true as const, profitUsd };
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
    if (!this.marketsFetchingCooldownMechanism.isReady()) return;

    try {
      const wasMorphoApiVaultMode = this.vaultWhitelist === "morpho-api";

      let vaultWhitelist: Address[];
      if (this.vaultWhitelist === "morpho-api") {
        vaultWhitelist = await fetchWhitelistedVaults(this.chainId);
        this.vaultWhitelist = vaultWhitelist;
      } else {
        vaultWhitelist = this.vaultWhitelist;
      }

      console.log(`${this.logTag}📝 Watching markets in the following vaults:`, vaultWhitelist);

      const whitelistedMarketsFromVaults = await this.dataProvider.fetchMarkets(
        this.client,
        vaultWhitelist,
      );

      /// Markets discovered from vaults and from the additional whitelist may overlap; dedupe so
      /// the data provider isn't asked to scan the same market twice.
      this.coveredMarkets = [
        ...new Set(
          [...whitelistedMarketsFromVaults, ...this.additionalMarketsWhitelist].map(
            (id) => id.toLowerCase() as Hex,
          ),
        ),
      ];

      /// Treat "no markets to cover" as a transient failure: a flaky Morpho API or RPC blip at
      /// boot must not lock the bot into an empty market set for the whole cooldown period.
      const morphoApiReturnedNoVaults = wasMorphoApiVaultMode && vaultWhitelist.length === 0;
      const vaultsGaveNoMarkets =
        vaultWhitelist.length > 0 &&
        whitelistedMarketsFromVaults.length === 0 &&
        this.additionalMarketsWhitelist.length === 0;

      if (morphoApiReturnedNoVaults || vaultsGaveNoMarkets) {
        console.warn(
          `${this.logTag}fetchMarkets returned an empty market set, scheduling a fast retry`,
        );
        this.marketsFetchingCooldownMechanism.scheduleRetryAfterFailure();
        return;
      }

      this.marketsFetchingCooldownMechanism.scheduleNextFetchAfterSuccess();
    } catch (error) {
      console.error(`${this.logTag}Error in fetchMarkets():`, error);
      this.marketsFetchingCooldownMechanism.scheduleRetryAfterFailure();
    }
  }
}
