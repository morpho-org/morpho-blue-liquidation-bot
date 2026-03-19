import { GraphQLClient, RequestOptions } from "graphql-request";
import gql from "graphql-tag";

import * as Types from "./types.js";
type GraphQLClientRequestHeaders = RequestOptions["requestHeaders"];

export const GetPositionsDocument = gql`
  query getPositions(
    $chainId: Int!
    $marketIds: [String!]
    $skip: Int
    $first: Int = 100
    $orderBy: MarketPositionOrderBy
    $orderDirection: OrderDirection
  ) {
    marketPositions(
      skip: $skip
      first: $first
      where: { chainId_in: [$chainId], marketUniqueKey_in: $marketIds, borrowShares_gte: 1 }
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
          preLiquidations {
            items {
              address
              preLltv
              preLCF1
              preLCF2
              preLIF1
              preLIF2
              preLiquidationOracle
            }
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

export type SdkFunctionWrapper = <T>(
  action: (requestHeaders?: Record<string, string>) => Promise<T>,
  operationName: string,
  operationType?: string,
  variables?: any,
) => Promise<T>;

const defaultWrapper: SdkFunctionWrapper = (action, _operationName, _operationType, _variables) =>
  action();

export function getSdk(client: GraphQLClient, withWrapper: SdkFunctionWrapper = defaultWrapper) {
  return {
    getPositions(
      variables: Types.GetPositionsQueryVariables,
      requestHeaders?: GraphQLClientRequestHeaders,
      signal?: RequestInit["signal"],
    ): Promise<Types.GetPositionsQuery> {
      return withWrapper(
        (wrappedRequestHeaders) =>
          client.request<Types.GetPositionsQuery>({
            document: GetPositionsDocument,
            variables,
            requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders },
            signal,
          }),
        "getPositions",
        "query",
        variables,
      );
    },
  };
}
export type Sdk = ReturnType<typeof getSdk>;
