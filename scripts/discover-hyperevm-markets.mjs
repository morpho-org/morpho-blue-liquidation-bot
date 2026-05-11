// One-shot HyperEVM market discovery.
//
// Usage:
//   RPC_URL_999=https://... node scripts/discover-hyperevm-markets.mjs
//
// Steps:
//   1. Read each Felix vault's withdrawQueue() on-chain -> already-covered marketIds.
//   2. Pull all HyperEVM markets from the Morpho GraphQL API with their borrowAssets.
//   3. Diff -> candidate marketIds NOT already covered by a Felix vault.
//   4. Annotate each candidate with collateral / loan symbols + borrow.

import { createPublicClient, http } from "viem";
import { defineChain } from "viem";

const hyperevm = defineChain({
  id: 999,
  name: "HyperEVM",
  network: "hyperevm",
  nativeCurrency: { symbol: "HYPE", name: "HYPE", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.hyperliquid.xyz/evm"] } },
});

const FELIX_VAULTS = [
  { name: "Felix USDC", address: "0x8A862fD6c12f9ad34C9c2ff45AB2b6712e8CEa27" },
  { name: "Felix USDT", address: "0xFc5126377F0efc0041C0969Ef9BA903Ce67d151e" },
  { name: "Felix HYPE", address: "0x2900ABd73631b2f60747e687095537B673c06A76" },
];

const metaMorphoAbi = [
  {
    type: "function",
    name: "withdrawQueueLength",
    inputs: [],
    outputs: [{ type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "withdrawQueue",
    inputs: [{ type: "uint256" }],
    outputs: [{ type: "bytes32" }],
    stateMutability: "view",
  },
];

const rpcUrl = process.env.RPC_URL_999 ?? "https://rpc.hyperliquid.xyz/evm";
const client = createPublicClient({ chain: hyperevm, transport: http(rpcUrl) });

async function readVaultMarkets(vaultAddress) {
  const len = await client.readContract({
    address: vaultAddress,
    abi: metaMorphoAbi,
    functionName: "withdrawQueueLength",
  });
  const ids = [];
  for (let i = 0n; i < len; i++) {
    const id = await client.readContract({
      address: vaultAddress,
      abi: metaMorphoAbi,
      functionName: "withdrawQueue",
      args: [i],
    });
    ids.push(id.toLowerCase());
  }
  return ids;
}

async function fetchMorphoMarkets() {
  const q = `
    query {
      markets(where: { chainId_in: [999] }, first: 500) {
        items {
          uniqueKey
          loanAsset { symbol address }
          collateralAsset { symbol address }
          state { borrowAssets }
        }
      }
    }
  `;
  const res = await fetch("https://blue-api.morpho.org/graphql", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query: q }),
  });
  const json = await res.json();
  if (json.errors) {
    throw new Error("Morpho API error: " + JSON.stringify(json.errors));
  }
  return json.data.markets.items;
}

const felixCovered = new Set();
for (const v of FELIX_VAULTS) {
  const ids = await readVaultMarkets(v.address);
  console.log(`[${v.name}] ${ids.length} markets in withdrawQueue`);
  for (const id of ids) felixCovered.add(id);
}
console.log(`\nFelix vaults already cover ${felixCovered.size} unique marketIds.\n`);

const allMarkets = await fetchMorphoMarkets();
console.log(`Morpho API returned ${allMarkets.length} HyperEVM markets total.\n`);

function asBig(x) {
  if (x === null || x === undefined) return 0n;
  return typeof x === "string" ? BigInt(x) : BigInt(x);
}

const candidates = allMarkets
  .filter((m) => m.uniqueKey && !felixCovered.has(m.uniqueKey.toLowerCase()))
  .filter((m) => m.collateralAsset && m.loanAsset)
  .map((m) => ({
    id: m.uniqueKey,
    loan: m.loanAsset.symbol,
    coll: m.collateralAsset.symbol,
    borrow: asBig(m.state?.borrowAssets),
  }))
  .filter((m) => m.borrow > 0n)
  .sort((a, b) => (b.borrow > a.borrow ? 1 : -1));

console.log("--- Candidate markets NOT in any Felix vault (borrow > 0) ---");
console.log("(filtered out: PT-* collaterals — no Pendle venue on HyperEVM)\n");

const withoutPT = candidates.filter((m) => !/^PT-/i.test(m.coll));
const ptOnly = candidates.filter((m) => /^PT-/i.test(m.coll));

for (const m of withoutPT) {
  console.log(
    `${m.id}  ${m.coll.padEnd(28)} / ${m.loan.padEnd(10)}  borrow=${m.borrow.toString()}`,
  );
}

console.log(`\n--- Excluded PT markets (${ptOnly.length}) ---`);
for (const m of ptOnly) {
  console.log(`${m.id}  ${m.coll} / ${m.loan}`);
}
