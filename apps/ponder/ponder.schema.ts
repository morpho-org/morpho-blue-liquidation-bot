import { index, onchainTable, primaryKey, relations, sql } from "ponder";
import { zeroAddress } from "viem";

/*//////////////////////////////////////////////////////////////
                            MARKETS
//////////////////////////////////////////////////////////////*/

export const market = onchainTable(
  "market",
  (t) => ({
    chainId: t.integer().notNull(),
    id: t.hex().notNull(),

    // MarketParams fields
    loanToken: t.hex().notNull(),
    collateralToken: t.hex().notNull(),
    oracle: t.hex().notNull(),
    irm: t.hex().notNull(),
    lltv: t.bigint().notNull(),

    // Market fields
    totalSupplyAssets: t.bigint().notNull().default(0n),
    totalSupplyShares: t.bigint().notNull().default(0n),
    totalBorrowAssets: t.bigint().notNull().default(0n),
    totalBorrowShares: t.bigint().notNull().default(0n),
    lastUpdate: t.bigint().notNull(),
    fee: t.bigint().notNull().default(0n),

    // AdaptiveCurveIrm fields
    rateAtTarget: t.bigint().notNull().default(0n),
  }),
  (table) => ({
    // Composite primary key uniquely identifies a market across chains
    pk: primaryKey({ columns: [table.chainId, table.id] }),
  }),
);

export const marketRelations = relations(market, ({ many }) => ({
  positions: many(position),
  relatedPreLiquidationContracts: many(preLiquidationContract),
}));

/*//////////////////////////////////////////////////////////////
                            POSITIONS
//////////////////////////////////////////////////////////////*/

export const position = onchainTable(
  "position",
  (t) => ({
    chainId: t.integer().notNull(),
    marketId: t.hex().notNull(),
    user: t.hex().notNull(),

    // Position fields
    supplyShares: t.bigint().notNull().default(0n),
    borrowShares: t.bigint().notNull().default(0n),
    collateral: t.bigint().notNull().default(0n),
  }),
  (table) => ({
    // Composite primary key uniquely identifies a position across chains
    pk: primaryKey({ columns: [table.chainId, table.marketId, table.user] }),
    // Index speeds up relational queries
    marketIdx: index().on(table.chainId, table.marketId),
  }),
);

export const positionRelations = relations(position, ({ one }) => ({
  market: one(market, {
    fields: [position.chainId, position.marketId],
    references: [market.chainId, market.id],
  }),
}));

/*//////////////////////////////////////////////////////////////
                          AUTHORIZATIONS
//////////////////////////////////////////////////////////////*/

export const authorization = onchainTable(
  "authorization",
  (t) => ({
    chainId: t.integer().notNull(),
    authorizer: t.hex().notNull(),
    authorizee: t.hex().notNull(),
    isAuthorized: t.boolean().notNull().default(false),
  }),
  (table) => ({
    // Composite primary key uniquely identifies an authorization across chains
    pk: primaryKey({ columns: [table.chainId, table.authorizer, table.authorizee] }),
    // Indexes speed up relational queries
    authorizerIdx: index()
      .on(table.chainId, table.authorizer)
      .where(sql`${table.isAuthorized} = true`),
    authorizeeIdx: index()
      .on(table.chainId, table.authorizee)
      .where(sql`${table.isAuthorized} = true`),
  }),
);

/*//////////////////////////////////////////////////////////////
                          PRELIQUIDATION
//////////////////////////////////////////////////////////////*/

export const preLiquidationContract = onchainTable(
  "pre_liquidation_contract",
  (t) => ({
    chainId: t.integer().notNull(),
    marketId: t.hex().notNull(),
    address: t.hex().notNull(),

    // PreLiquidationParams fields
    preLltv: t.bigint().notNull(),
    preLCF1: t.bigint().notNull(),
    preLCF2: t.bigint().notNull(),
    preLIF1: t.bigint().notNull(),
    preLIF2: t.bigint().notNull(),
    preLiquidationOracle: t.hex().notNull(),
  }),
  (table) => ({
    // Composite primary key uniquely identifies a preliquidation contract across chains
    pk: primaryKey({ columns: [table.chainId, table.marketId, table.address] }),
    // Index speeds up relational queries
    marketIdx: index().on(table.chainId, table.marketId),
  }),
);

export const preLiquidationContractRelations = relations(preLiquidationContract, ({ one }) => ({
  market: one(market, {
    fields: [preLiquidationContract.chainId, preLiquidationContract.marketId],
    references: [market.chainId, market.id],
  }),
}));

/*//////////////////////////////////////////////////////////////
                          VAULTS
//////////////////////////////////////////////////////////////*/

export const vault = onchainTable(
  "vault",
  (t) => ({
    chainId: t.integer().notNull(),
    address: t.hex().notNull(),

    withdrawQueue: t.hex().array().notNull().default([]),
  }),
  (table) => ({
    // Composite primary key uniquely identifies a vault across chains
    pk: primaryKey({ columns: [table.chainId, table.address] }),
  }),
);
