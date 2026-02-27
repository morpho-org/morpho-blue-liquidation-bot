FROM node:20-alpine

# Set working directory
WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy package files first for better layer caching
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/config/package.json ./apps/config/
COPY apps/client/package.json ./apps/client/

# Copy vendor directory (for local packages like viem-dlc)
# The morpho-org-viem-dlc-0.0.1.tgz file must be placed in vendor/ before building
COPY vendor/ ./vendor/

# Install dependencies (this layer will be cached unless package files change)
# Note: node_modules will be installed for Linux platform inside the container
RUN pnpm install --fetch-retries 5 --frozen-lockfile

# Copy the rest of the source code
COPY . .

# Railway automatically injects these base environment variables:
# - RPC_URL_<chainId>
# - EXECUTOR_ADDRESS_<chainId>
# - LIQUIDATION_PRIVATE_KEY_<chainId>
# - RAILWAY_DEPLOYMENT_ID

# Declare the chain IDs we support as an environment variable for looping
ENV CHAIN_IDS="1 130 137 8453 747474"

# Declare the non-dynamic vars so they are available at runtime
ENV LIQUIDATION_PRIVATE_KEY=${LIQUIDATION_PRIVATE_KEY}
ENV RAILWAY_DEPLOYMENT_ID=${RAILWAY_DEPLOYMENT_ID}

# Create cache directory and declare it as a volume to persist between runs
RUN mkdir -p .cache
VOLUME ["/app/.cache"]

# Build the .env file dynamically at container start
CMD ["sh", "-lc", "{ \
  for CHAIN in $CHAIN_IDS; do \
    echo \"RPC_URL_${CHAIN}=$(printenv RPC_URL_$CHAIN)\"; \
    echo \"EXECUTOR_ADDRESS_${CHAIN}=$(printenv EXECUTOR_ADDRESS_$CHAIN)\"; \
    echo \"LIQUIDATION_PRIVATE_KEY_${CHAIN}=$(printenv LIQUIDATION_PRIVATE_KEY)\"; \
  done; \
  echo \"RAILWAY_DEPLOYMENT_ID=$(printenv RAILWAY_DEPLOYMENT_ID)\"; \
} > .env && pnpm run liquidate"]
