# syntax=docker/dockerfile:1.7
FROM node:24.18.0-bookworm-slim AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable && corepack prepare pnpm@11.11.0 --activate
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/api-contracts/package.json packages/api-contracts/
COPY packages/protocol-contracts/package.json packages/protocol-contracts/
COPY packages/atproto-lexicons/package.json packages/atproto-lexicons/
COPY packages/greenfield-contracts/package.json packages/greenfield-contracts/
COPY packages/greenfield-module-manifest/package.json packages/greenfield-module-manifest/
COPY packages/greenfield-module-registry-contracts/package.json packages/greenfield-module-registry-contracts/
COPY packages/greenfield-protocol/package.json packages/greenfield-protocol/
COPY packages/greenfield-schema-registry/package.json packages/greenfield-schema-registry/
COPY packages/dimon-contracts/package.json packages/dimon-contracts/
COPY packages/greenfield-product-standard/package.json packages/greenfield-product-standard/
COPY services/greenfield-worker/package.json services/greenfield-worker/
COPY --from=modula-module-standard / /modula-mod/modula-module-standard
RUN pnpm install --frozen-lockfile --filter @modula/greenfield-worker...

FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages ./packages
COPY --from=deps /app/services ./services
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages ./packages
COPY services/greenfield-worker ./services/greenfield-worker
COPY --from=modula-module-standard / /modula-mod/modula-module-standard
RUN pnpm --filter @modula/api-contracts build \
 && pnpm --filter @modula/protocol-contracts build \
 && pnpm --filter @modula/atproto-lexicons build \
 && pnpm --filter @modula/greenfield-contracts build \
 && pnpm --filter @modula/greenfield-module-manifest build \
 && pnpm --filter @modula/greenfield-module-registry-contracts build \
 && pnpm --filter @modula/greenfield-protocol build \
 && pnpm --filter @modula/greenfield-schema-registry build \
 && pnpm --filter @modula/dimon-contracts build \
 && pnpm --filter @modula/greenfield-worker build
RUN pnpm --config.inject-workspace-packages=true --filter @modula/greenfield-worker deploy --prod /prod/worker

FROM node:24.18.0-bookworm-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app
RUN apt-get update \
 && apt-get upgrade -y \
 && rm -rf /var/lib/apt/lists/* /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx \
 && groupadd --system modula \
 && useradd --system --gid modula --create-home modula
COPY --from=build --chown=modula:modula /prod/worker ./
USER modula
CMD ["node", "dist/main.js"]
