import { ponder } from "ponder:registry";
import { market } from "ponder:schema";

ponder.on("AdaptiveCurveIRM:BorrowRateUpdate", async ({ event, context }) => {
  // Row must exist because `BorrowRateUpdate` cannot preceed `CreateMarket`.
  await context.db
    .update(market, {
      // primary key
      chainId: context.chain.id,
      id: event.args.id,
    })
    .set({
      rateAtTarget: event.args.rateAtTarget,
    });
});
