import { Account, Address, Chain, Hex, Transport, WalletClient } from "viem";
import { getBlockNumber } from "viem/actions";

import { TenderlyConfig } from "./types";

export async function getTenderlySimulationUrl(
  data: Hex,
  client: WalletClient<Transport, Chain, Account>,
  tenderlyConfig: TenderlyConfig | undefined,
  executorAddress: Address,
  eoaAddress: Address,
): Promise<string> {
  if (!tenderlyConfig) {
    return "";
  }

  const blockNumber = (await getBlockNumber(client)) + 1n;

  const params = new URLSearchParams({
    block: blockNumber.toString(),
    blockIndex: "0",
    from: eoaAddress,
    gas: "8000000",
    gasPrice: "0",
    value: "0",
    contractAddress: executorAddress,
    headerBlockNumber: "",
    headerTimestamp: "",
    network: client.chain.id.toString(),
    rawFunctionInput: data,
  });

  const url = `https://dashboard.tenderly.co/${tenderlyConfig.tenderlyAccount}/${tenderlyConfig.tenderlyProject}/simulator/new?${params.toString()}`;
  return `\n<${url}|Tenderly simulation URL>`;
}
