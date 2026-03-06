import { Morpho } from "generated";
import { marketId, positionId, authorizationId } from "../utils/ids.js";

Morpho.CreateMarket.handler(async ({ event, context }) => {
  const id = marketId(event.chainId, event.params.id);

  context.Market.set({
    id,
    chainId: event.chainId,
    marketId: event.params.id,
    loanToken: event.params.marketParams[0],
    collateralToken: event.params.marketParams[1],
    oracle: event.params.marketParams[2],
    irm: event.params.marketParams[3],
    lltv: event.params.marketParams[4],
    totalSupplyAssets: 0n,
    totalSupplyShares: 0n,
    totalBorrowAssets: 0n,
    totalBorrowShares: 0n,
    lastUpdate: BigInt(event.block.timestamp),
    fee: 0n,
    rateAtTarget: 0n,
  });
});

Morpho.SetFee.handler(async ({ event, context }) => {
  const id = marketId(event.chainId, event.params.id);
  const existing = await context.Market.get(id);
  if (!existing) return;

  context.Market.set({
    ...existing,
    fee: event.params.newFee,
  });
});

Morpho.AccrueInterest.handler(async ({ event, context }) => {
  const id = marketId(event.chainId, event.params.id);
  const existing = await context.Market.get(id);
  if (!existing) return;

  context.Market.set({
    ...existing,
    totalSupplyAssets: existing.totalSupplyAssets + event.params.interest,
    totalSupplyShares: existing.totalSupplyShares + event.params.feeShares,
    totalBorrowAssets: existing.totalBorrowAssets + event.params.interest,
    lastUpdate: BigInt(event.block.timestamp),
  });
});

Morpho.Supply.handler(async ({ event, context }) => {
  const mId = marketId(event.chainId, event.params.id);
  const market = await context.Market.get(mId);
  if (market) {
    context.Market.set({
      ...market,
      totalSupplyAssets: market.totalSupplyAssets + event.params.assets,
      totalSupplyShares: market.totalSupplyShares + event.params.shares,
    });
  }

  const pId = positionId(event.chainId, event.params.id, event.params.onBehalf);
  const position = await context.Position.getOrCreate({
    id: pId,
    chainId: event.chainId,
    market_id: mId,
    user: event.params.onBehalf,
    supplyShares: 0n,
    borrowShares: 0n,
    collateral: 0n,
  });
  context.Position.set({
    ...position,
    supplyShares: position.supplyShares + event.params.shares,
  });
});

Morpho.Withdraw.handler(async ({ event, context }) => {
  const mId = marketId(event.chainId, event.params.id);
  const market = await context.Market.get(mId);
  if (market) {
    context.Market.set({
      ...market,
      totalSupplyAssets: market.totalSupplyAssets - event.params.assets,
      totalSupplyShares: market.totalSupplyShares - event.params.shares,
    });
  }

  const pId = positionId(event.chainId, event.params.id, event.params.onBehalf);
  const position = await context.Position.getOrCreate({
    id: pId,
    chainId: event.chainId,
    market_id: mId,
    user: event.params.onBehalf,
    supplyShares: 0n,
    borrowShares: 0n,
    collateral: 0n,
  });
  context.Position.set({
    ...position,
    supplyShares: position.supplyShares - event.params.shares,
  });
});

Morpho.SupplyCollateral.handler(async ({ event, context }) => {
  const mId = marketId(event.chainId, event.params.id);
  const pId = positionId(event.chainId, event.params.id, event.params.onBehalf);
  const position = await context.Position.getOrCreate({
    id: pId,
    chainId: event.chainId,
    market_id: mId,
    user: event.params.onBehalf,
    supplyShares: 0n,
    borrowShares: 0n,
    collateral: 0n,
  });
  context.Position.set({
    ...position,
    collateral: position.collateral + event.params.assets,
  });
});

Morpho.WithdrawCollateral.handler(async ({ event, context }) => {
  const mId = marketId(event.chainId, event.params.id);
  const pId = positionId(event.chainId, event.params.id, event.params.onBehalf);
  const position = await context.Position.getOrCreate({
    id: pId,
    chainId: event.chainId,
    market_id: mId,
    user: event.params.onBehalf,
    supplyShares: 0n,
    borrowShares: 0n,
    collateral: 0n,
  });
  context.Position.set({
    ...position,
    collateral: position.collateral - event.params.assets,
  });
});

Morpho.Borrow.handler(async ({ event, context }) => {
  const mId = marketId(event.chainId, event.params.id);
  const market = await context.Market.get(mId);
  if (market) {
    context.Market.set({
      ...market,
      totalBorrowAssets: market.totalBorrowAssets + event.params.assets,
      totalBorrowShares: market.totalBorrowShares + event.params.shares,
    });
  }

  const pId = positionId(event.chainId, event.params.id, event.params.onBehalf);
  const position = await context.Position.getOrCreate({
    id: pId,
    chainId: event.chainId,
    market_id: mId,
    user: event.params.onBehalf,
    supplyShares: 0n,
    borrowShares: 0n,
    collateral: 0n,
  });
  context.Position.set({
    ...position,
    borrowShares: position.borrowShares + event.params.shares,
  });
});

Morpho.Repay.handler(async ({ event, context }) => {
  const mId = marketId(event.chainId, event.params.id);
  const market = await context.Market.get(mId);
  if (market) {
    context.Market.set({
      ...market,
      totalBorrowAssets: market.totalBorrowAssets - event.params.assets,
      totalBorrowShares: market.totalBorrowShares - event.params.shares,
    });
  }

  const pId = positionId(event.chainId, event.params.id, event.params.onBehalf);
  const position = await context.Position.getOrCreate({
    id: pId,
    chainId: event.chainId,
    market_id: mId,
    user: event.params.onBehalf,
    supplyShares: 0n,
    borrowShares: 0n,
    collateral: 0n,
  });
  context.Position.set({
    ...position,
    borrowShares: position.borrowShares - event.params.shares,
  });
});

Morpho.Liquidate.handler(async ({ event, context }) => {
  const mId = marketId(event.chainId, event.params.id);
  const market = await context.Market.get(mId);
  if (market) {
    context.Market.set({
      ...market,
      totalSupplyAssets: market.totalSupplyAssets - event.params.badDebtAssets,
      totalSupplyShares: market.totalSupplyShares - event.params.badDebtShares,
      totalBorrowAssets:
        market.totalBorrowAssets - event.params.repaidAssets - event.params.badDebtAssets,
      totalBorrowShares:
        market.totalBorrowShares - event.params.repaidShares - event.params.badDebtShares,
    });
  }

  const pId = positionId(event.chainId, event.params.id, event.params.borrower);
  const position = await context.Position.getOrCreate({
    id: pId,
    chainId: event.chainId,
    market_id: mId,
    user: event.params.borrower,
    supplyShares: 0n,
    borrowShares: 0n,
    collateral: 0n,
  });
  context.Position.set({
    ...position,
    collateral: position.collateral - event.params.seizedAssets,
    borrowShares:
      position.borrowShares - event.params.repaidShares - event.params.badDebtShares,
  });
});

Morpho.SetAuthorization.handler(async ({ event, context }) => {
  const id = authorizationId(
    event.chainId,
    event.params.authorizer,
    event.params.authorized,
  );

  context.Authorization.set({
    id,
    chainId: event.chainId,
    authorizer: event.params.authorizer,
    authorizee: event.params.authorized,
    isAuthorized: event.params.newIsAuthorized,
  });
});
