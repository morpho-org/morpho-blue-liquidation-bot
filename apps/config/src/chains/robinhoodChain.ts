import { registerCustomAddresses } from "@morpho-org/blue-sdk";
import { defineChain } from "viem";

export const robinhoodChain = defineChain({
  id: 4663,
  name: "Robinhood Chain",
  network: "robinhoodChain",
  nativeCurrency: {
    symbol: "ETH",
    name: "Ether",
    decimals: 18,
  },
  // No public RPC yet — `RPC_URL_4663` must be set in the environment.
  rpcUrls: {
    default: {
      http: [],
    },
  },
});

// Register the chain's Morpho deployment with `@morpho-org/blue-sdk` so
// `getChainAddresses(4663)` / `fetchMarket` / `fetchAccrualPosition` resolve.
// Side-effect at module load: this file is imported transitively from
// `apps/config/src/index.ts`, so the registration runs before any bot is
// constructed.
registerCustomAddresses({
  addresses: {
    [robinhoodChain.id]: {
      morpho: "0x9D53d5E3bd5E8d4Cbfa6DB1ca238AEA02E651010",
      adaptiveCurveIrm: "0x2BD3d5965B26B51814AC95127B2b80dD6CcC0fa1",
      bundler3: {
        bundler3: "0x6478e9393d4C5bB4d53ee881d1DE78786A0344a6",
        generalAdapter1: "0xc5E188541D107e8B79e43478bDE365F1406665D6",
      },
      preLiquidationFactory: "0x0B0cFa151c06d2342799267754b0a2c320C43D5B",
      chainlinkOracleFactory: "0xB7c16F6F8cF531447Bf27Ca7220f981E79C9cdF2",
      vaultV2Factory: "0x0FBad98595b0186dA120E41f77C102beb49f803c",
      morphoMarketV1AdapterV2Factory: "0x79370Ed003CE325C088E530d5e8655c99c2993e1",
      morphoVaultV1AdapterFactory: "0x7a91222F3f7B927bB8fb624593Ca86e111C2F85e",
      registryList: "0xe785a2eFD384BA7B95BaEd3851BC76aeD67C676f",
      wNative: "0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73",
    },
  },
});
