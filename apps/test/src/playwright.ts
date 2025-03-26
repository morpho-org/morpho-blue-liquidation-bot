import { test } from "@playwright/test";
import { http, type Chain, formatUnits } from "viem";
import { type AnvilArgs, spawnAnvil } from "./anvil";
import { type AnvilTestClient, createAnvilTestClient } from "./client";

export interface PlaywrightTestContext<chain extends Chain = Chain> {
  client: AnvilTestClient<chain>;
}

export const createViemTest = <chain extends Chain>(chain: chain, parameters: AnvilArgs = {}) => {
  parameters.forkChainId ??= chain?.id;
  parameters.forkUrl ??= chain?.rpcUrls.default.http[0];
  parameters.autoImpersonate ??= true;
  parameters.order ??= "fifo";
  parameters.stepsTracing ??= true;

  parameters.gasPrice ??= 0n;
  parameters.blockBaseFeePerGas ??= 0n;

  return test.extend<PlaywrightTestContext<chain>>({
    // biome-ignore lint/correctness/noEmptyPattern: required by playwright at runtime
    client: async ({}, use) => {
      const { rpcUrl, stop } = await spawnAnvil(parameters, test.info().workerIndex);

      const client = createAnvilTestClient(http(rpcUrl), chain);

      // Make block timestamp 100% predictable.
      await client.setBlockTimestampInterval({ interval: 1 });

      await use(client);

      await stop();
    },
  });
};

export const expect = test.expect.extend({
  toApproxEqual(received: bigint, expected: bigint, numDigits = 2, decimals = 18) {
    const assertionName = "toApproxEqual";

    const receivedNumber = Number(formatUnits(received, decimals));
    const expectedNumber = Number(formatUnits(expected, decimals));

    let pass: boolean;
    // biome-ignore lint/suspicious/noExplicitAny: <explanation>
    let matcherResult: any;
    try {
      test.expect(receivedNumber).toBeCloseTo(expectedNumber, numDigits);
      pass = true;
    } catch (error) {
      // @ts-expect-error
      matcherResult = error.matcherResult;
      pass = false;
    }

    return {
      message: () => {
        return `${this.utils.matcherHint(assertionName, undefined, undefined, {
          isNot: this.isNot,
        })}

Expected: ${this.utils.printExpected(expectedNumber)}
Received: ${this.utils.printReceived(receivedNumber)}

Expected precision:  ${numDigits}
Expected difference: ${this.isNot ? ">=" : "<"} ${this.utils.printExpected(10 ** -numDigits / 2)}
Received difference: ${this.utils.printReceived(Math.abs(receivedNumber - expectedNumber))}`;
      },
      pass,
      name: assertionName,
      expected,
      actual: matcherResult?.actual,
    };
  },
});
