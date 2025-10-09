import { Address } from "viem";
import { base, mainnet } from "viem/chains";

export type MidasConfig = {
  instantRedemptionVault: Address;
  redemptionAssets: Address[];
};

export const midasConfigs: Record<number, Record<Address, MidasConfig>> = {
  [mainnet.id]: {
    "0xDD629E5241CbC5919847783e6C96B2De4754e438": {
      // mTBILL
      instantRedemptionVault: "0x569D7dccBF6923350521ecBC28A555A500c4f0Ec",
      redemptionAssets: ["0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"], // USDC
    },
    "0x007115416AB6c266329a03B09a8aa39aC2eF7d9d": {
      // mBTC
      instantRedemptionVault: "0x30d9D1e76869516AEa980390494AaEd45C3EfC1a",
      redemptionAssets: [
        "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599", // WBTC
        "0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf", // cbBTC
      ],
    },
    "0xbB51E2a15A9158EBE2b0Ceb8678511e063AB7a55": {
      // mEdge
      instantRedemptionVault: "0x9B2C5E30E3B1F6369FC746A1C1E47277396aF15D",
      redemptionAssets: ["0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"], // USDC
    },
    "0x030b69280892c888670EDCDCD8B69Fd8026A0BF3": {
      // mMEV
      instantRedemptionVault: "0xac14a14f578C143625Fc8F54218911e8F634184D",
      redemptionAssets: ["0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"], // USDC
    },
    "0xb64C014307622eB15046C66fF71D04258F5963DC": {
      // mevBTC
      instantRedemptionVault: "0x2d7d5b1706653796602617350571B3F8999B950c",
      redemptionAssets: ["0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599"], // WBTC
    },
    "0x87C9053C819bB28e0D73d33059E1b3DA80AFb0cf": {
      // mRe7YIELD
      instantRedemptionVault: "0x5356B8E06589DE894D86B24F4079c629E8565234",
      redemptionAssets: ["0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"], // USDC
    },
    "0x9FB442d6B612a6dcD2acC67bb53771eF1D9F661A": {
      // mRe7BTC
      instantRedemptionVault: "0x4Fd4DD7171D14e5bD93025ec35374d2b9b4321b0",
      redemptionAssets: [
        "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599", // WBTC
        "0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf", // cbBTC
        "0x18084fbA666a33d37592fA2633fD49a74DD93a88", // tBTC
      ],
    },
    "0x238a700eD6165261Cf8b2e544ba797BC11e466Ba": {
      // mf-ONE
      instantRedemptionVault: "0x41438435c20B1C2f1fcA702d387889F346A0C3DE",
      redemptionAssets: ["0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"], // USDC
    },
    "0x20226607b4fa64228ABf3072Ce561d6257683464": {
      // msyrupUSD
      instantRedemptionVault: "0x9f7dd5462C183B6577858e16a13A4d864CE2f972",
      redemptionAssets: [
        "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", // USDC
        "0x80ac24aA929eaF5013f6436cdA2a7ba190f5Cc0b", // syrupUSDC
      ],
    },
    "0x2fE058CcF29f123f9dd2aEC0418AA66a877d8E50": {
      // msyrupUSDp
      instantRedemptionVault: "0x71EFa7AF1686C5c04AA34a120a91cb4262679C44",
      redemptionAssets: [
        "0x356B8d89c1e1239Cbbb9dE4815c39A1474d5BA7D", // syrupUSDT
        "0xdAC17F958D2ee523a2206206994597C13D831ec7", // USDT
        "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", // USDC
      ],
    },
    "0x7CF9DEC92ca9FD46f8d86e7798B72624Bc116C05": {
      // mAPOLLO
      instantRedemptionVault: "0x5aeA6D35ED7B3B7aE78694B7da2Ee880756Af5C0",
      redemptionAssets: ["0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"], // USDC
    },
    "0xA19f6e0dF08a7917F2F8A33Db66D0AF31fF5ECA6": {
      // mFARM
      instantRedemptionVault: "0xf4F042D90f0C0d3ABA4A30Caa6Ac124B14A7e600",
      redemptionAssets: ["0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"], // USDC
    },
    "0x9b5528528656DBC094765E2abB79F293c21191B9": {
      // mHYPER
      instantRedemptionVault: "0x6Be2f55816efd0d91f52720f096006d63c366e98",
      redemptionAssets: ["0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"], // USDC
    },
    "0x605A84861EE603e385b01B9048BEa6A86118DB0a": {
      // mWildUSD
      instantRedemptionVault: "0x2f98A13635F6CEc0cc45bC1e43969C71d68091d6",
      redemptionAssets: [
        "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", // USDC
        "0xdAC17F958D2ee523a2206206994597C13D831ec7", // USDT
        "0x4c9EDD5852cd905f086C759E8383e09bff1E68B3", // USDe
      ],
    },
  },
  [base.id]: {
    "0xDD629E5241CbC5919847783e6C96B2De4754e438": {
      // mTBILL
      instantRedemptionVault: "0x2a8c22E3b10036f3AEF5875d04f8441d4188b656",
      redemptionAssets: ["0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"], // USDC
    },
    "0x1C2757c1FeF1038428b5bEF062495ce94BBe92b2": {
      // mBASIS
      instantRedemptionVault: "0xF804a646C034749b5484bF7dfE875F6A4F969840",
      redemptionAssets: ["0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"], // USDC
    },
  },
  /* [katana.id]: {
    "0xC6135d59F8D10c9C035963ce9037B3635170D716": {
      // mRe7SOL
      instantRedemptionVault: "0xE93E6Cf151588d63bB669138277D20f28C2E7cdA",
      redemptionAssets: [
        "0x9B8Df6E244526ab5F6e6400d331DB28C8fdDdb55", // uSOL
        "0x6C16E26013f2431e8B2e1Ba7067ECCcad0Db6C52", // jitoSOL
      ],
    },
  }, */
};
