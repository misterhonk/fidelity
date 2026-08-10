# Fidelity, the hub — optional by construction (ADR-008).
#
# Nothing in the app requires it. It caches the expensive, impersonal half of
# the horizon and the shipping ladders somebody typed in, so the second person
# to expand Conny Plank does not pay for it again.
#
# No database driver and no native build: node:sqlite ships with Node — which is
# why there is no compiler in this image and no gyp step in this build.
#
#   docker build -f deploy/hub.Dockerfile -t fidelity-hub .

FROM node:24-alpine

WORKDIR /app

COPY hub/package.json hub/package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund

COPY hub/src ./src

# The data lives on a volume, never in the image. Losing it costs requests,
# not correctness — every entry is reproducible from Discogs.
ENV HUB_PORT=8787 \
    HUB_DB=/data/hub.sqlite
VOLUME /data

# Runs as node, not root. It is a cache reachable from a home network, and one
# day somebody will put it on the open internet anyway.
RUN mkdir -p /data && chown -R node:node /data
USER node

EXPOSE 8787

# /v1/health is deliberately open (docs/13): a health check that needs the
# secret is a health check nobody wires up.
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s \
  CMD wget -q -O /dev/null http://127.0.0.1:8787/v1/health || exit 1

CMD ["node", "src/server.ts"]
