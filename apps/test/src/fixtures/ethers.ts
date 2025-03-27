import { HDNodeWallet, type Provider } from "ethers";

export function testWallet<T extends Provider>(
  provider: T,
  index?: number,
): HDNodeWallet & { provider: T };
export function testWallet<T extends Provider>(
  provider?: T,
  index?: number,
): HDNodeWallet;
export function testWallet<T extends Provider>(provider?: T, index = 0) {
  return HDNodeWallet.fromPhrase(
    "test test test test test test test test test test test junk",
    undefined,
    `m/44'/60'/0'/0/${index}`,
  ).connect(provider ?? null);
}
