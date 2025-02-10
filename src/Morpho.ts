import { ponder } from "ponder:registry";

ponder.on("Morpho:AccrueInterest", async ({ event, context }) => {
  console.log(event.args);
});

ponder.on("Morpho:Borrow", async ({ event, context }) => {
  console.log(event.args);
});

ponder.on("Morpho:CreateMarket", async ({ event, context }) => {
  console.log(event.args);
});

ponder.on("Morpho:EnableIrm", async ({ event, context }) => {
  console.log(event.args);
});
