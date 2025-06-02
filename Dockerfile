FROM node:20-alpine

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy package files
COPY . .

# Install dependencies
RUN pnpm install

# Railway automatically injects these environment variables
# We just need to declare them so they're properly used by the application
# --> rpc urls
ENV RPC_URL_1=$RPC_URL_1
ENV RPC_URL_130=$RPC_URL_130
ENV RPC_URL_137=$RPC_URL_137
ENV RPC_URL_8453=$RPC_URL_8453
# --> executooor deployment addresses
ENV EXECUTOR_ADDRESS_130=$EXECUTOR_ADDRESS_130
# --> eoa private keys
ENV LIQUIDATION_PRIVATE_KEY_130=$LIQUIDATION_PRIVATE_KEY_130
# --> other
ENV DATABASE_URL=$DATABASE_URL
ENV RAILWAY_DEPLOYMENT_ID=$RAILWAY_DEPLOYMENT_ID

# Run the start command
# WORKDIR /app/apps/ponder
CMD sh -c '\
  printf "RPC_URL_1=%s\nRPC_URL_130=%s\nRPC_URL_137=%s\nRPC_URL_8453=%s\nEXECUTOR_ADDRESS_130=%s\nLIQUIDATION_PRIVATE_KEY_130=%s\nDATABASE_URL=%s\nRAILWAY_DEPLOYMENT_ID=%s\n" \
    "$RPC_URL_1" \
    "$RPC_URL_130" \
    "$RPC_URL_137" \
    "$RPC_URL_8453" \
    "$EXECUTOR_ADDRESS_130" \
    "$LIQUIDATION_PRIVATE_KEY_130" \
    "$DATABASE_URL" \
    "$RAILWAY_DEPLOYMENT_ID" \
  > .env \
  && pnpm run liquidate'
