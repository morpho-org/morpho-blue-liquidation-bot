import type { CodegenConfig } from "@graphql-codegen/cli";

// Option 1: If you have @morpho-org/morpho-ts installed
// import { BLUE_API_GRAPHQL_URL } from "@morpho-org/morpho-ts";

// Option 2: Or use the URL directly
const BLUE_API_GRAPHQL_URL = "https://api.morpho.org/graphql";

const config: CodegenConfig = {
  overwrite: true,
  schema: BLUE_API_GRAPHQL_URL,
  documents: ["graphql/**/*.{query,fragment}.gql"], // Adjust path to your GraphQL files
  generates: {
    "src/api/types.ts": {
      plugins: ["typescript-operations"],
      preset: "import-types",
      presetConfig: {
        typesPath: "@morpho-org/blue-api-sdk", // If using blue-api-sdk types
        // OR use "./types.js" if generating base types yourself
      },
      config: {
        avoidOptionals: {
          field: true,
          inputValue: false,
          defaultValue: true,
        },
        scalars: {
          BigInt: {
            input: `Types.Scalars["BigInt"]["input"]`,
            output: `Types.Scalars["BigInt"]["output"]`,
          },
          HexString: {
            input: `Types.Scalars["HexString"]["input"]`,
            output: `Types.Scalars["HexString"]["output"]`,
          },
          Address: {
            input: `Types.Scalars["Address"]["input"]`,
            output: `Types.Scalars["Address"]["output"]`,
          },
          MarketId: {
            input: `Types.Scalars["MarketId"]["input"]`,
            output: `Types.Scalars["MarketId"]["output"]`,
          },
        },
      },
    },
    "src/api/sdk.ts": {
      plugins: ["typescript-graphql-request"],
      preset: "import-types",
      presetConfig: {
        typesPath: "./types.js",
      },
    },
  },
};

export default config;
