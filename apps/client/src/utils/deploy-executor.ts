import { bytecode, executorAbi } from "executooor-viem";
import { type Address, type WalletClient } from "viem";
import { waitForTransactionReceipt } from "viem/actions";

export const deploy = async (client: WalletClient, account: Address) => {
  const hash = await client.deployContract({
    abi: executorAbi,

    account: client.account!,
    bytecode,
    args: [account],
    chain: client.chain,
  });

  const tx = await waitForTransactionReceipt(client, { hash });

  console.log(`Executor deployed on ${client.chain?.id} at ${tx.contractAddress}`);

  return tx.contractAddress;
};
