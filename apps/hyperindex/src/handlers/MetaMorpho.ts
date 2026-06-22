import { MetaMorphoFactory, MetaMorpho } from "generated";
import { getAddress } from "viem";
import { vaultId } from "../utils/ids.js";

MetaMorphoFactory.CreateMetaMorpho.contractRegister(({ event, context }) => {
  context.addMetaMorpho(event.params.metaMorpho);
});

MetaMorphoFactory.CreateMetaMorpho.handler(async ({ event, context }) => {
  const id = vaultId(event.chainId, event.params.metaMorpho);

  context.Vault.set({
    id,
    chainId: event.chainId,
    address: getAddress(event.params.metaMorpho),
    withdrawQueue: [],
  });
});

MetaMorpho.SetWithdrawQueue.handler(async ({ event, context }) => {
  const id = vaultId(event.chainId, event.srcAddress);

  context.Vault.set({
    id,
    chainId: event.chainId,
    address: getAddress(event.srcAddress),
    withdrawQueue: [...event.params.newWithdrawQueue],
  });
});
