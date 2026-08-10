# Fidelity, the app.
#
# There is no server here. ADR-007 made this a client-only PWA, so what ships
# is a directory of files and something to hand them out — which is why the
# final stage is nginx and not Node. The build needs Node; running does not.
#
#   docker build -f deploy/app.Dockerfile -t fidelity-app .

# --- build ------------------------------------------------------------------
FROM node:24-alpine AS build

# corepack pins the pnpm version from package.json, so the image builds with
# the same one the lockfile was written by.
RUN corepack enable

WORKDIR /src

# Dependencies first, so a change to a Vue file does not reinstall 900 packages.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY scripts ./scripts
COPY tokens ./tokens

# --ignore-scripts: postinstall runs `nuxt prepare`, which wants the whole
# source tree that is not copied yet. It runs as part of the build below.
RUN pnpm install --frozen-lockfile --ignore-scripts

COPY . .

RUN pnpm tokens:build && pnpm icons:build && pnpm exec nuxt build

# --- serve ------------------------------------------------------------------
FROM nginx:1.29-alpine AS serve

COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /src/.output/public /usr/share/nginx/html

# nginx:alpine ships an unprivileged variant of its own entrypoint; this image
# keeps the default one so it can bind 80 inside the container. The published
# port is chosen by compose, not here.
EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s \
  CMD wget -q -O /dev/null http://127.0.0.1/ || exit 1
