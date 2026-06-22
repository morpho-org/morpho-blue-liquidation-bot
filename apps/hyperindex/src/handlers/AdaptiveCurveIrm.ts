import { AdaptiveCurveIRM } from "generated";
import { marketId } from "../utils/ids.js";

AdaptiveCurveIRM.BorrowRateUpdate.handler(async ({ event, context }) => {
  const id = marketId(event.chainId, event.params.id);
  const existing = await context.Market.get(id);
  if (!existing) return;

  context.Market.set({
    ...existing,
    rateAtTarget: event.params.rateAtTarget,
  });
});
