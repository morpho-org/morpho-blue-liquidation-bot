import { checksumAddress } from "viem";
import { mnemonicToAccount } from "viem/accounts";

let seed = 1;
const seededRandom = () => {
  const x = Math.sin(seed++) * 10000;
  return x - Math.floor(x);
};

export const randomAddress = (chainId?: number) =>
  checksumAddress(
    `0x${new Array(40)
      .fill(0)
      .map(() => Math.floor(seededRandom() * 16).toString(16))
      .join("")}`,
    chainId,
  );

export const testAccount = (addressIndex?: number) =>
  mnemonicToAccount(
    "test test test test test test test test test test test junk",
    { addressIndex },
  );
