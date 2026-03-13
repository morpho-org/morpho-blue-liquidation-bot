FROM node:20-alpine

# Set working directory
WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy project files and install dependencies
COPY . .
RUN pnpm install --fetch-retries 5

# Railway automatically injects these base environment variables:
# - RPC_URL_<chainId>
# - EXECUTOR_ADDRESS_<chainId>
# - LIQUIDATION_PRIVATE_KEY_<chainId>
# - DATABASE_URL
# - RAILWAY_DEPLOYMENT_ID

# Declare the chain IDs we support as an environment variable for looping
ENV CHAIN_IDS="1 8453 130 747474 42161 999 143 10 137 480"

# Declare the non-dynamic vars so they are available at runtime
ENV LIQUIDATION_PRIVATE_KEY=${LIQUIDATION_PRIVATE_KEY}
ENV ONE_INCH_SWAP_API_KEY=${ONE_INCH_SWAP_API_KEY}
ENV HYPERINDEX_URL=${HYPERINDEX_URL}
ENV RAILWAY_DEPLOYMENT_ID=${RAILWAY_DEPLOYMENT_ID}

# Build the .env file dynamically at container start
CMD ["sh", "-lc", "{ \
  for CHAIN in $CHAIN_IDS; do \
    echo \"RPC_URL_${CHAIN}=$(printenv RPC_URL_$CHAIN)\"; \
    echo \"EXECUTOR_ADDRESS_${CHAIN}=$(printenv EXECUTOR_ADDRESS_$CHAIN)\"; \
    echo \"LIQUIDATION_PRIVATE_KEY_${CHAIN}=$(printenv LIQUIDATION_PRIVATE_KEY)\"; \
  done; \
  echo \"ONE_INCH_SWAP_API_KEY=$(printenv ONE_INCH_SWAP_API_KEY)\"; \
  echo \"HYPERINDEX_URL=$(printenv HYPERINDEX_URL)\"; \
  echo \"RAILWAY_DEPLOYMENT_ID=$(printenv RAILWAY_DEPLOYMENT_ID)\"; \
} > .env && pnpm run liquidate"]