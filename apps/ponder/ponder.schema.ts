import { index, onchainTable, primaryKey, relations } from "ponder";

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

    // AdaptiveCurveIRM fields
    rateAtTarget: t.bigint().notNull().default(0n),
  }),
  (table) => ({
    // Composite primary key uniquely identifies a market across chains
    pk: primaryKey({ columns: [table.chainId, table.id] }),
  }),
);

export const marketRelations = relations(market, ({ many }) => ({
  positions: many(position),
}));

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

export const preLiquidation = onchainTable(
  "preLiquidation",
  (t) => ({
    chainId: t.integer().notNull(),
    marketId: t.hex().notNull(),
    address: t.hex().notNull(),

    preLltv: t.bigint().notNull(),
    preLCF1: t.bigint().notNull(),
    preLCF2: t.bigint().notNull(),
    preLIF1: t.bigint().notNull(),
    preLIF2: t.bigint().notNull(),
    preLiquidationOracle: t.hex().notNull(),
  }),
  (table) => ({
    // Composite primary key uniquely identifies a preLiquidation across chains
    pk: primaryKey({ columns: [table.chainId, table.marketId, table.address] }),
    // Index speeds up relational queries
    marketIdx: index().on(table.chainId, table.marketId),
  }),
);

export const authorization = onchainTable(
  "authorization",
  (t) => ({
    chainId: t.integer().notNull(),
    authorizer: t.hex().notNull(),
    authorized: t.hex().notNull(),

    isAuthorized: t.boolean().notNull(),
  }),
  (table) => ({
    // Composite primary key uniquely identifies an authorization across chains
    pk: primaryKey({ columns: [table.chainId, table.authorizer, table.authorized] }),
  }),
);

export const authorizationRelations = relations(position, ({ many }) => ({
  authorizer: many(position),
}));
