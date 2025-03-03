import { ponder } from "ponder:registry";
import { vault } from "ponder:schema";

ponder.on("MetaMorpho:SetWithdrawQueue", async ({ event, context }) => {
  await context.db
    .update(vault, {
      chainId: context.network.chainId,
      address: event.log.address,
    })
    .set({
      withdrawQueue: [...event.args.newWithdrawQueue],
    });
});
