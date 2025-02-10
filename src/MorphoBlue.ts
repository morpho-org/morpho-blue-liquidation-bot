import { ponder } from "ponder:registry";
import { market, position } from "ponder:schema";

ponder.on("Morpho:CreateMarket", async ({ event, context }) => {
  // `CreateMarket` can only fire once for a given `{ chainId, id }`,
  // so we can insert without any `onConflict` handling.
  await context.db.insert(market).values({
    // primary key
    chainId: context.network.chainId,
    id: event.args.id,
    // `MarketParams` struct
    loanToken: event.args.marketParams.loanToken,
    collateralToken: event.args.marketParams.collateralToken,
    oracle: event.args.marketParams.oracle,
    irm: event.args.marketParams.irm,
    lltv: event.args.marketParams.lltv,
    // `Market` struct (unspecified fields default to 0n)
    lastUpdate: event.block.timestamp,
  });
});

ponder.on("Morpho:SetFee", async ({ event, context }) => {
  // Row must exist because `SetFee` cannot preceed `CreateMarket`.
  await context.db
    .update(market, {
      chainId: context.network.chainId,
      id: event.args.id,
    })
    .set({ fee: event.args.newFee });
});

ponder.on("Morpho:AccrueInterest", async ({ event, context }) => {
  // Row must exist because `AccrueInterest` cannot preceed `CreateMarket`.
  await context.db
    .update(market, {
      chainId: context.network.chainId,
      id: event.args.id,
    })
    .set((row) => ({
      totalSupplyAssets: row.totalSupplyAssets + event.args.interest,
      totalSupplyShares: row.totalSupplyShares + event.args.feeShares,
      totalBorrowAssets: row.totalBorrowAssets + event.args.interest,
      lastUpdate: event.block.timestamp,
    }));
});

ponder.on("Morpho:Supply", async ({ event, context }) => {
  await Promise.all([
    // Row must exist because `Supply` cannot preceed `CreateMarket`.
    context.db
      .update(market, { chainId: context.network.chainId, id: event.args.id })
      .set((row) => ({
        totalSupplyAssets: row.totalSupplyAssets + event.args.assets,
        totalSupplyShares: row.totalSupplyShares + event.args.shares,
      })),
    // Row may or may not exist because `Supply` could be `user`'s first action.
    context.db
      .insert(position)
      .values({
        // primary key
        chainId: context.network.chainId,
        marketId: event.args.id,
        user: event.args.onBehalf,
        // `Position` struct (unspecified fields default to 0n)
        supplyShares: event.args.shares,
      })
      .onConflictDoUpdate((row) => ({
        supplyShares: row.supplyShares + event.args.shares,
      })),
  ]);
});

ponder.on("Morpho:Withdraw", async ({ event, context }) => {
  await Promise.all([
    // Row must exist because `Withdraw` cannot preceed `CreateMarket`.
    context.db
      .update(market, { chainId: context.network.chainId, id: event.args.id })
      .set((row) => ({
        totalSupplyAssets: row.totalSupplyAssets - event.args.assets,
        totalSupplyShares: row.totalSupplyShares - event.args.shares,
      })),
    // Row must exist because `Withdraw` cannot preceed `Supply`.
    context.db
      .update(position, {
        chainId: context.network.chainId,
        marketId: event.args.id,
        user: event.args.onBehalf,
      })
      .set((row) => ({ supplyShares: row.supplyShares - event.args.shares })),
  ]);
});

ponder.on("Morpho:SupplyCollateral", async ({ event, context }) => {
  // Row may or may not exist because `SupplyCollateral` could be `user`'s first action.
  await context.db
    .insert(position)
    .values({
      // primary key
      chainId: context.network.chainId,
      marketId: event.args.id,
      user: event.args.onBehalf,
      // `Position` struct (unspecified fields default to 0n)
      collateral: event.args.assets,
    })
    .onConflictDoUpdate((row) => ({
      collateral: row.collateral + event.args.assets,
    }));
});

ponder.on("Morpho:WithdrawCollateral", async ({ event, context }) => {
  // Row must exist because `WithdrawCollateral` cannot preceed `SupplyCollateral`.
  await context.db
    .update(position, {
      chainId: context.network.chainId,
      marketId: event.args.id,
      user: event.args.onBehalf,
    })
    .set((row) => ({ collateral: row.collateral - event.args.assets }));
});

ponder.on("Morpho:Borrow", async ({ event, context }) => {
  await Promise.all([
    // Row must exist because `Borrow` cannot preceed `CreateMarket`.
    context.db
      .update(market, { chainId: context.network.chainId, id: event.args.id })
      .set((row) => ({
        totalBorrowAssets: row.totalBorrowAssets + event.args.assets,
        totalBorrowShares: row.totalBorrowShares + event.args.shares,
      })),
    // Row must exist because `Borrow` cannot preceed `SupplyCollateral`.
    context.db
      .update(position, {
        chainId: context.network.chainId,
        marketId: event.args.id,
        user: event.args.onBehalf,
      })
      .set((row) => ({ borrowShares: row.borrowShares + event.args.shares })),
  ]);
});

ponder.on("Morpho:Repay", async ({ event, context }) => {
  await Promise.all([
    // Row must exist because `Repay` cannot preceed `CreateMarket`.
    context.db
      .update(market, { chainId: context.network.chainId, id: event.args.id })
      .set((row) => ({
        totalBorrowAssets: row.totalBorrowAssets - event.args.assets,
        totalBorrowShares: row.totalBorrowShares - event.args.shares,
      })),
    // Row must exist because `Repay` cannot preceed `SupplyCollateral`.
    context.db
      .update(position, {
        chainId: context.network.chainId,
        marketId: event.args.id,
        user: event.args.onBehalf,
      })
      .set((row) => ({ borrowShares: row.borrowShares - event.args.shares })),
  ]);
});

ponder.on("Morpho:Liquidate", async ({ event, context }) => {
  await Promise.all([
    // Row must exist because `Liquidate` cannot preceed `CreateMarket`.
    context.db
      .update(market, { chainId: context.network.chainId, id: event.args.id })
      .set((row) => ({
        totalSupplyAssets: row.totalSupplyAssets - event.args.badDebtAssets,
        totalSupplyShares: row.totalSupplyAssets - event.args.badDebtShares,
        totalBorrowAssets: row.totalBorrowAssets - event.args.repaidAssets,
        totalBorrowShares: row.totalBorrowShares - event.args.repaidShares,
      })),
    // Row must exist because `Liquidate` cannot preceed `SupplyCollateral`.
    context.db
      .update(position, {
        chainId: context.network.chainId,
        marketId: event.args.id,
        user: event.args.borrower,
      })
      .set((row) => ({
        collateral: row.collateral - event.args.seizedAssets,
        borrowShares:
          row.borrowShares - event.args.repaidShares - event.args.badDebtShares,
      })),
  ]);
});
