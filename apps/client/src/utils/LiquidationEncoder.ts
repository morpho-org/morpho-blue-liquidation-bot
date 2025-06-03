import { ExecutorEncoder } from "executooor-viem";
import type { Account, Address, Chain, Client, Hex, Transport } from "viem";
import { encodeAbiParameters, encodeFunctionData } from "viem";
import { preLiquidationAbi } from "../abis/PreLiquidation";

export class LiquidationEncoder<
  client extends Client<Transport, Chain, Account> = Client<Transport, Chain, Account>,
> extends ExecutorEncoder<client> {
  public preLiquidate(
    preLiquidation: Address,
    borrower: Address,
    seizedAssets: bigint,
    repaidShares: bigint,
    callbackCalls?: Hex[],
  ) {
    this.pushCall(
      preLiquidation,
      0n,
      encodeFunctionData({
        abi: preLiquidationAbi,
        functionName: "preLiquidate",
        args: [
          borrower,
          seizedAssets,
          repaidShares,
          encodeAbiParameters(
            [{ type: "bytes[]" }, { type: "bytes" }],
            [callbackCalls ?? [], "0x"],
          ),
        ],
      }),
      {
        sender: preLiquidation,
        dataIndex: 1n, // onPreLiquidate(uint256,bytes)
      },
    );
  }
}
