import { ponder } from "ponder:registry";
import { preLiquidation } from "ponder:schema";

ponder.on("PreLiquidationFactory:CreatePreLiquidation", async ({ event, context }) => {
  // `CreatePreLiquidation` can only fire once for a given `{ chainId, id, preLiquidationParams}`,
  // so we can insert without any `onConflict` handling.
  await context.db.insert(preLiquidation).values({
    chainId: context.chain.id,
    marketId: event.args.id,
    address: event.args.preLiquidation,

    // `PreLiquidationParams` struct
    preLltv: event.args.preLiquidationParams.preLltv,
    preLCF1: event.args.preLiquidationParams.preLCF1,
    preLCF2: event.args.preLiquidationParams.preLCF2,
    preLIF1: event.args.preLiquidationParams.preLIF1,
    preLIF2: event.args.preLiquidationParams.preLIF2,
    preLiquidationOracle: event.args.preLiquidationParams.preLiquidationOracle,
  });
});
