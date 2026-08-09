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
COPY packages/greenfield-protocol/package.json packages/greenfield-protocol/
COPY packages/greenfield-schema-registry/package.json packages/greenfield-schema-registry/
COPY packages/dimon-contracts/package.json packages/dimon-contracts/
COPY services/greenfield-worker/package.json services/greenfield-worker/
COPY patches ./patches
COPY --from=modula-module-standard / /modula-mod/modula-module-standard
RUN pnpm install --frozen-lockfile --filter @modula/greenfield-worker...

FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages ./packages
COPY --from=deps /app/services ./services
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY patches ./patches
COPY packages ./packages
COPY services/greenfield-worker ./services/greenfield-worker
RUN pnpm --filter @modula/api-contracts build \
 && pnpm --filter @modula/protocol-contracts build \
 && pnpm --filter @modula/atproto-lexicons build \
 && pnpm --filter @modula/greenfield-contracts build \
 && pnpm --filter @modula/greenfield-protocol build \
 && pnpm --filter @modula/greenfield-schema-registry build \
 && pnpm --filter @modula/dimon-contracts build \
 && pnpm --filter @modula/greenfield-worker build

FROM node:24.18.0-bookworm-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app
RUN groupadd --system modula && useradd --system --gid modula --create-home modula \
 && corepack enable && corepack prepare pnpm@11.11.0 --activate
COPY --from=build --chown=modula:modula /app/package.json /app/pnpm-lock.yaml /app/pnpm-workspace.yaml ./
COPY --from=build --chown=modula:modula /app/node_modules ./node_modules
COPY --from=build --chown=modula:modula /app/packages ./packages
COPY --from=build --chown=modula:modula /app/services/greenfield-worker ./services/greenfield-worker
USER modula
CMD ["node", "services/greenfield-worker/dist/main.js"]
