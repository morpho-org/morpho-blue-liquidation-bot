import { Address } from "@morpho-org/blue-sdk";
import { base, mainnet } from "viem/chains";

export const ROUTER_ADDRESSES: Record<number, Address> = {
  [mainnet.id]: "0x888888888889758F76e7103c6CbF23ABbF58F946",
  [base.id]: "0x888888888889758F76e7103c6CbF23ABbF58F946",
};

export const API_REFRESH_INTERVAL = 1000 * 60 * 60 * 6; // 6 hours
