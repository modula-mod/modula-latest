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
COPY packages/greenfield-connector-contracts/package.json packages/greenfield-connector-contracts/
COPY packages/greenfield-contracts/package.json packages/greenfield-contracts/
COPY packages/greenfield-module-engine-contracts/package.json packages/greenfield-module-engine-contracts/
COPY packages/greenfield-module-manifest/package.json packages/greenfield-module-manifest/
COPY packages/greenfield-module-registry-contracts/package.json packages/greenfield-module-registry-contracts/
COPY packages/greenfield-module-ui-contracts/package.json packages/greenfield-module-ui-contracts/
COPY packages/greenfield-protocol/package.json packages/greenfield-protocol/
COPY packages/greenfield-runtime/package.json packages/greenfield-runtime/
COPY packages/greenfield-schema-registry/package.json packages/greenfield-schema-registry/
COPY packages/greenfield-product-standard/package.json packages/greenfield-product-standard/
COPY packages/dimon-contracts/package.json packages/dimon-contracts/
COPY packages/intelligence-contracts/package.json packages/intelligence-contracts/
COPY packages/intelligence-governance/package.json packages/intelligence-governance/
COPY services/greenfield-api/package.json services/greenfield-api/
COPY --from=modula-module-standard / /modula-mod/modula-module-standard
RUN pnpm install --frozen-lockfile --filter @modula/greenfield-api...

FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages ./packages
COPY --from=deps /app/services ./services
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages ./packages
COPY services/greenfield-api ./services/greenfield-api
COPY --from=modula-module-standard / /modula-mod/modula-module-standard
RUN pnpm --filter @modula/api-contracts build \
 && pnpm --filter @modula/protocol-contracts build \
 && pnpm --filter @modula/atproto-lexicons build \
 && pnpm --filter @modula/greenfield-connector-contracts build \
 && pnpm --filter @modula/greenfield-contracts build \
 && pnpm --filter @modula/greenfield-module-engine-contracts build \
 && pnpm --filter @modula/greenfield-module-manifest build \
 && pnpm --filter @modula/greenfield-module-ui-contracts build \
 && pnpm --filter @modula/greenfield-module-registry-contracts build \
 && pnpm --filter @modula/greenfield-protocol build \
 && pnpm --filter @modula/greenfield-runtime build \
 && pnpm --filter @modula/greenfield-schema-registry build \
 && pnpm --filter @modula/greenfield-product-standard build \
 && pnpm --filter @modula/dimon-contracts build \
 && pnpm --filter @modula/intelligence-contracts build \
 && pnpm --filter @modula/intelligence-governance build \
 && pnpm --filter @modula/greenfield-api build
RUN pnpm --config.inject-workspace-packages=true --filter @modula/greenfield-api deploy --prod /prod/api

FROM node:24.18.0-bookworm-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app
RUN apt-get update \
 && apt-get upgrade -y \
 && rm -rf /var/lib/apt/lists/* /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx \
 && groupadd --system modula \
 && useradd --system --gid modula --create-home modula
COPY --from=build --chown=modula:modula /prod/api ./
USER modula
EXPOSE 4020
HEALTHCHECK --interval=15s --timeout=5s --retries=5 CMD node -e "fetch('http://127.0.0.1:4020/v1/health/live').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist/main.js"]
