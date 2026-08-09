# Node 22, not 24 or 26: Uberspace offers 18/20/22 only, and 22 is its default.
# A different local major means debugging version differences instead of features.
FROM node:22-alpine AS base
RUN corepack enable
WORKDIR /app

# ---------------------------------------------------------------------------
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
# --ignore-scripts: our postinstall builds tokens and runs `nuxt prepare`, and
# neither can work before the sources are copied.
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm config set store-dir /pnpm/store && \
    pnpm install --frozen-lockfile --ignore-scripts

# ---------------------------------------------------------------------------
# Development target used by docker/compose.yml. The compose file bind-mounts
# the working tree over /app and keeps this node_modules via an anonymous
# volume, so the sources here are only a fallback for `docker run`.
FROM base AS dev
ENV NODE_ENV=development
COPY --from=deps /app/node_modules ./node_modules
COPY . .
EXPOSE 3000
CMD ["pnpm", "dev", "--host", "0.0.0.0"]

# ---------------------------------------------------------------------------
FROM deps AS build
COPY . .
RUN pnpm build

# ---------------------------------------------------------------------------
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV NITRO_PORT=3000
ENV NITRO_HOST=0.0.0.0

# Nitro's .output is self-contained — no node_modules needed. That is the
# largest image-size win available here and it is routinely missed.
COPY --from=build /app/.output ./

USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s --start-period=20s \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server/index.mjs"]
