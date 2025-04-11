import { type Address, erc20Abi, parseUnits } from "viem";
import { readContract, writeContract } from "viem/actions";
import { describe, expect } from "vitest";
import { test } from "../setup.js";
import { deploy } from "../../src/deployExecutor.js";
import { executorAbi, ExecutorEncoder } from "executooor-viem";
import { testAccount } from "@morpho-org/test";
import { USDC } from "../constants.js";

describe("executor deployment", () => {
  const randomAddress = testAccount(2);
  const amount = parseUnits("1000", 6);

  test.sequential("should test deploy", async ({ client }) => {
    const executorAddress = (await deploy(client, client.account.address).catch(
      () => {},
    )) as Address;

    const encoder = new ExecutorEncoder(executorAddress, client);

    await client.deal({
      erc20: USDC,
      account: executorAddress,
      amount,
    });

    encoder.erc20Transfer(USDC, randomAddress.address, amount);

    const calls = encoder.flush();

    await writeContract(client, {
      address: encoder.address,
      abi: executorAbi,
      functionName: "exec_606BaXt",
      args: [calls],
    });

    const balance = await readContract(client, {
      address: USDC,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [randomAddress.address],
    });

    expect(balance).toBe(amount);
  });
});
