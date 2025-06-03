import { ponder } from "ponder:registry";
import { vault } from "ponder:schema";

ponder.on("MetaMorpho:SetWithdrawQueue", async ({ event, context }) => {
  await context.db
    .insert(vault)
    .values({
      // primary key
      chainId: context.chain.id,
      address: event.log.address,

      // `WithdrawQueue`
      withdrawQueue: [...event.args.newWithdrawQueue],
    })
    .onConflictDoUpdate({
      withdrawQueue: [...event.args.newWithdrawQueue],
    });
});
