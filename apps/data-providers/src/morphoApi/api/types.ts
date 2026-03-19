import * as Types from "@morpho-org/blue-api-sdk";

export type GetPositionsQueryVariables = Types.Exact<{
  chainId: Types.Scalars["Int"]["input"];
  marketIds?: Types.InputMaybe<
    Types.Scalars["String"]["input"][] | Types.Scalars["String"]["input"]
  >;
  skip?: Types.InputMaybe<Types.Scalars["Int"]["input"]>;
  first?: Types.InputMaybe<Types.Scalars["Int"]["input"]>;
  orderBy?: Types.InputMaybe<Types.MarketPositionOrderBy>;
  orderDirection?: Types.InputMaybe<Types.OrderDirection>;
}>;

export interface GetPositionsQuery {
  __typename?: "Query";
  marketPositions: {
    __typename?: "PaginatedMarketPositions";
    pageInfo: {
      __typename?: "PageInfo";
      count: number;
      countTotal: number;
      limit: number;
      skip: number;
    } | null;
    items:
      | {
          __typename?: "MarketPosition";
          healthFactor: number | null;
          user: { __typename?: "User"; address: Types.Scalars["Address"]["output"] };
          market: {
            __typename?: "Market";
            uniqueKey: Types.Scalars["MarketId"]["output"];
            oracle: { __typename?: "Oracle"; address: Types.Scalars["Address"]["output"] } | null;
            preLiquidations: {
              __typename?: "PaginatedPreLiquidations";
              items: {
                __typename?: "PreLiquidationModel";
                address: Types.Scalars["Address"]["output"];
                preLltv: Types.Scalars["BigInt"]["output"];
                preLCF1: Types.Scalars["BigInt"]["output"];
                preLCF2: Types.Scalars["BigInt"]["output"];
                preLIF1: Types.Scalars["BigInt"]["output"];
                preLIF2: Types.Scalars["BigInt"]["output"];
                preLiquidationOracle: Types.Scalars["Address"]["output"];
              }[] | null;
            } | null;
          };
          state: {
            __typename?: "MarketPositionState";
            borrowShares: Types.Scalars["BigInt"]["output"];
            collateral: Types.Scalars["BigInt"]["output"];
            supplyShares: Types.Scalars["BigInt"]["output"];
          } | null;
        }[]
      | null;
  };
}
