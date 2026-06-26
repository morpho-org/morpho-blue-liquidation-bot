import {
  type Account,
  type Chain,
  type FormattedTransactionRequest,
  type Hex,
  type LocalAccount,
  type Transport,
  type UnionOmit,
  type WalletClient,
  keccak256,
  stringToBytes,
} from "viem";
import { estimateGas, getTransactionCount } from "viem/actions";

export namespace Flashbots {
  let nextId = 0;

  export const FLASHBOTS_RELAY = "https://relay.flashbots.net";

  /**
   * Signs a Flashbots bundle with this provider's `authSigner` key.
   * @param bundledTransactions
   * @returns signed bundle
   *
   * @example
   * ```typescript
   * const bundle: Array<FlashbotsBundleRawTransaction> = [
   *    {signedTransaction: "0x02..."},
   *    {signedTransaction: "0x02..."},
   * ]
   * const signedBundle = await fbProvider.signBundle(bundle)
   * const blockNum = await provider.getBlockNumber()
   * const simResult = await fbProvider.simulate(signedBundle, blockNum + 1)
   * ```
   */
  export async function signBundle<client extends WalletClient<Transport, Chain, Account>>(
    bundle: {
      transaction: UnionOmit<FormattedTransactionRequest, "from">;
      client: client;
    }[],
  ) {
    const nonces: { [address: string]: number } = {};

    const signatures: Hex[] = [];
    for (const { transaction, client } of bundle) {
      const address = client.account.address;

      const nonce =
        transaction.nonce ?? nonces[address] ?? (await getTransactionCount(client, { address }));

      nonces[address] = nonce + 1;
      transaction.nonce ??= nonce;

      transaction.gas ??= await estimateGas(client, transaction); // TODO: Add target block number and timestamp when supported by geth

      signatures.push(await client.signTransaction(transaction));
    }

    return signatures;
  }

  /**
   * Sends a signed flashbots bundle to Flashbots Relay.
   * @param signedBundledTransactions array of raw signed transactions
   * @param targetBlockNumber block to target for bundle inclusion
   * @param opts (optional) settings
   * @returns callbacks for handling results, and the bundle hash
   *
   * @example
   * ```typescript
   * const bundle: Array<FlashbotsBundleRawTransaction> = [
   *    {signedTransaction: "0x02..."},
   *    {signedTransaction: "0x02..."},
   * ]
   * const signedBundle = await fbProvider.signBundle(bundle)
   * const blockNum = await provider.getBlockNumber()
   * const bundleRes = await fbProvider.sendRawBundle(signedBundle, blockNum + 1)
   * const success = (await bundleRes.wait()) === FlashbotsBundleResolution.BundleIncluded
   * ```
   */
  export async function sendRawBundle(
    txs: Hex[],
    targetBlockNumber: bigint,
    account: LocalAccount,
  ) {
    const body = JSON.stringify({
      method: "eth_sendBundle",
      params: [
        {
          txs,
          blockNumber: `0x${targetBlockNumber.toString(16)}`,
        },
      ],
      id: nextId++,
      jsonrpc: "2.0",
    });

    const response = await fetch(FLASHBOTS_RELAY, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Flashbots-Signature": `${account.address}:${await account.signMessage({
          message: keccak256(stringToBytes(body)),
        })}`,
      },
      body,
    });

    if (!response.ok) {
      const body = (await response.json()) as any;

      throw Error(body.error ?? body ?? "eth_sendBundle failed");
    }
  }
}
