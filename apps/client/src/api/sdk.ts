import * as Types from './types.js';

import { GraphQLClient, RequestOptions } from 'graphql-request';
import gql from 'graphql-tag';
type GraphQLClientRequestHeaders = RequestOptions['requestHeaders'];

export const GetLiquidatablePositionsDocument = gql`
    query getLiquidatablePositions($chainId: Int!, $marketIds: [String!], $skip: Int, $first: Int = 100, $orderBy: MarketPositionOrderBy, $orderDirection: OrderDirection) {
  marketPositions(
    skip: $skip
    first: $first
    where: {chainId_in: [$chainId], marketUniqueKey_in: $marketIds, healthFactor_lte: 1}
    orderBy: $orderBy
    orderDirection: $orderDirection
  ) {
    pageInfo {
      count
      countTotal
      limit
      skip
    }
    items {
      healthFactor
      user {
        address
      }
      market {
        uniqueKey
        oracle {
          address
        }
      }
      state {
        borrowShares
        collateral
        supplyShares
      }
    }
  }
}
    `;

export type SdkFunctionWrapper = <T>(action: (requestHeaders?:Record<string, string>) => Promise<T>, operationName: string, operationType?: string, variables?: any) => Promise<T>;


const defaultWrapper: SdkFunctionWrapper = (action, _operationName, _operationType, _variables) => action();

export function getSdk(client: GraphQLClient, withWrapper: SdkFunctionWrapper = defaultWrapper) {
  return {
    getLiquidatablePositions(variables: Types.GetLiquidatablePositionsQueryVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<Types.GetLiquidatablePositionsQuery> {
      return withWrapper((wrappedRequestHeaders) => client.request<Types.GetLiquidatablePositionsQuery>({ document: GetLiquidatablePositionsDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'getLiquidatablePositions', 'query', variables);
    }
  };
}
export type Sdk = ReturnType<typeof getSdk>;