import { randomAddress } from "@morpho-org/test";
import type { Account, Address, Chain, Client, Transport } from "viem";
import { mainnet } from "viem/chains";
import { afterEach, describe, expect, it, vi } from "vitest";

import { MorphoApi } from "../../src";
import { WBTC, USDC } from "../constants.js";

interface PriceAssetsRequest {
  query: string;
  variables: {
    chainId: number;
    addresses: Address[];
    first: number;
  };
}

describe("morpho api pricer", () => {
  const client = { chain: mainnet } as Client<Transport, Chain, Account>;

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("should batch same-chain price requests", async () => {
    const pricer = new MorphoApi();
    const unknown = randomAddress(1);

    const fetchMock = vi.fn(
      async (_input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
        const body = JSON.parse(init?.body as string) as PriceAssetsRequest;

        expect(body.query).toContain("PriceAssets");
        expect(body.query).not.toContain("chains");
        expect(body.variables).toEqual({
          chainId: client.chain.id,
          addresses: [USDC, WBTC, unknown],
          first: 30,
        });

        return new Response(
          JSON.stringify({
            data: {
              assets: {
                items: [
                  { address: USDC, price: { usd: 1 } },
                  { address: WBTC, price: { usd: 50_000 } },
                ],
              },
            },
          }),
        );
      },
    );

    vi.stubGlobal("fetch", fetchMock);

    const [usdcPrice, wbtcPrice, unknownPrice] = await Promise.all([
      pricer.price(client, USDC),
      pricer.price(client, WBTC),
      pricer.price(client, unknown),
    ]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(usdcPrice).toBe(1);
    expect(wbtcPrice).toBe(50_000);
    expect(unknownPrice).toBeUndefined();
  });

  it("should split price requests into chunks of 30", async () => {
    const pricer = new MorphoApi();
    const addresses = Array.from({ length: 31 }, (_, index) => randomAddress(index + 1));
    const requestedChunks: Address[][] = [];

    const fetchMock = vi.fn(
      async (_input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
        const body = JSON.parse(init?.body as string) as PriceAssetsRequest;
        requestedChunks.push(body.variables.addresses);

        expect(body.variables.chainId).toBe(client.chain.id);
        expect(body.variables.first).toBe(30);

        return new Response(
          JSON.stringify({
            data: {
              assets: {
                items: body.variables.addresses.map((address) => ({
                  address,
                  price: { usd: 1 },
                })),
              },
            },
          }),
        );
      },
    );

    vi.stubGlobal("fetch", fetchMock);

    const prices = await Promise.all(addresses.map((address) => pricer.price(client, address)));

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(requestedChunks.map((chunk) => chunk.length)).toEqual([30, 1]);
    expect(prices.every((price) => price === 1)).toBe(true);
  });
});
