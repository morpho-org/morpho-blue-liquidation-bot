import { getAddress } from "viem";

export const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

export function marketId(chainId: number, id: string): string {
  return `${chainId}-${id}`;
}

export function positionId(chainId: number, marketId: string, user: string): string {
  return `${chainId}-${marketId}-${getAddress(user)}`;
}

export function authorizationId(chainId: number, authorizer: string, authorizee: string): string {
  return `${chainId}-${getAddress(authorizer)}-${getAddress(authorizee)}`;
}

export function preLiquidationContractId(
  chainId: number,
  marketId: string,
  address: string,
): string {
  return `${chainId}-${marketId}-${getAddress(address)}`;
}

export function vaultId(chainId: number, address: string): string {
  return `${chainId}-${getAddress(address)}`;
}
