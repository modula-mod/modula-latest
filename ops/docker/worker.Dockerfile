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
COPY services/worker/package.json services/worker/
RUN pnpm install --frozen-lockfile --filter @modula/worker...

FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages ./packages
COPY --from=deps /app/services ./services
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages ./packages
COPY services/worker ./services/worker
RUN pnpm --filter @modula/api-contracts build \
 && pnpm --filter @modula/protocol-contracts build \
 && pnpm --filter @modula/atproto-lexicons build \
 && pnpm --filter @modula/worker build

FROM node:24.18.0-bookworm-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app
RUN groupadd --system modula && useradd --system --gid modula --create-home modula \
 && corepack enable && corepack prepare pnpm@11.11.0 --activate
COPY --from=build /app/package.json /app/pnpm-lock.yaml /app/pnpm-workspace.yaml ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/packages ./packages
COPY --from=build /app/services/worker ./services/worker
USER modula
CMD ["node", "services/worker/dist/main.js"]
