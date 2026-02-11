FROM node:22-alpine

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy dependency files first for layer caching
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY patches/ patches/

# Copy workspace package.json files
COPY apps/client/package.json apps/client/
COPY apps/config/package.json apps/config/
COPY apps/ponder/package.json apps/ponder/

# Install dependencies
RUN pnpm install --frozen-lockfile --fetch-retries 5

# Copy application source
COPY . .

# Base chain only
ENV CHAIN_IDS="8453"

CMD ["pnpm", "run", "liquidate"]
