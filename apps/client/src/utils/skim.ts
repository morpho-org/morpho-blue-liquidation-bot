import { ExecutorEncoder } from "executooor-viem";
import {
  type Address,
  erc20Abi,
  formatUnits,
  type Account,
  type Chain,
  type Transport,
  type WalletClient,
} from "viem";
import { readContract } from "viem/actions";

/**
 * Skims the executor's balance of a token by reading the on-chain balance
 * and transferring it to the recipient via erc20Transfer.
 *
 * This avoids using erc20Skim which relies on the executor's placeholder/transient
 * storage mechanism (tload/tstore) that older executor contracts don't support.
 */
export async function skim(
  client: WalletClient<Transport, Chain, Account>,
  token: Address,
  executorAddress: Address,
  recipient: Address,
) {
  const encoder = new ExecutorEncoder(executorAddress, client);

  const [balance, decimals, symbol] = await Promise.all([
    readContract(client, {
      address: token,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [executorAddress],
    }),
    readContract(client, {
      address: token,
      abi: erc20Abi,
      functionName: "decimals",
    }),
    readContract(client, {
      address: token,
      abi: erc20Abi,
      functionName: "symbol",
    }),
  ]);

  if (balance > 0n) {
    encoder.erc20Transfer(token, recipient, balance);
    await encoder.exec();
    console.log(`Skimmed ${formatUnits(balance, decimals)} ${symbol} to ${recipient}`);
  }
}
