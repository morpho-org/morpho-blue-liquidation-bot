import { MetaMorphoFactory, MetaMorpho } from "generated";
import { vaultId } from "../utils/ids.js";

MetaMorphoFactory.CreateMetaMorpho.contractRegister(({ event, context }) => {
  context.addMetaMorpho(event.params.metaMorpho);
});

MetaMorphoFactory.CreateMetaMorpho.handler(async ({ event, context }) => {
  const id = vaultId(event.chainId, event.params.metaMorpho);

  context.Vault.set({
    id,
    chainId: event.chainId,
    address: event.params.metaMorpho,
    withdrawQueue: [],
  });
});

MetaMorpho.SetWithdrawQueue.handler(async ({ event, context }) => {
  const id = vaultId(event.chainId, event.srcAddress);

  context.Vault.set({
    id,
    chainId: event.chainId,
    address: event.srcAddress,
    withdrawQueue: [...event.params.newWithdrawQueue],
  });
});
