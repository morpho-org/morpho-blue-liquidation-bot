import * as Types from '@morpho-org/blue-api-sdk';

export type GetLiquidatablePositionsQueryVariables = Types.Exact<{
  chainId: Types.Scalars['Int']['input'];
  marketIds?: Types.InputMaybe<Array<Types.Scalars['String']['input']> | Types.Scalars['String']['input']>;
  skip?: Types.InputMaybe<Types.Scalars['Int']['input']>;
  first?: Types.InputMaybe<Types.Scalars['Int']['input']>;
  orderBy?: Types.InputMaybe<Types.MarketPositionOrderBy>;
  orderDirection?: Types.InputMaybe<Types.OrderDirection>;
}>;


export type GetLiquidatablePositionsQuery = { __typename?: 'Query', marketPositions: { __typename?: 'PaginatedMarketPositions', pageInfo: { __typename?: 'PageInfo', count: number, countTotal: number, limit: number, skip: number } | null, items: Array<{ __typename?: 'MarketPosition', healthFactor: number | null, user: { __typename?: 'User', address: Types.Scalars["Address"]["output"] }, market: { __typename?: 'Market', uniqueKey: Types.Scalars["MarketId"]["output"], oracle: { __typename?: 'Oracle', address: Types.Scalars["Address"]["output"] } | null }, state: { __typename?: 'MarketPositionState', borrowShares: Types.Scalars["BigInt"]["output"], collateral: Types.Scalars["BigInt"]["output"], supplyShares: Types.Scalars["BigInt"]["output"] } | null }> | null } };
