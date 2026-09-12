# Fidelity, the catalogue — the monthly CC0 dump, read once (ADR-013).
#
# This image is the build job: it fetches the four dump files, streams them
# into one SQLite file, checks the row counts against last month's, and moves
# the `current` symlink — then looks again tomorrow. The service that answers
# over HTTP (M21.4) will share the image and read what this leaves in /data.
#
# node:sqlite ships with Node, so no driver and no compiler here either.
#
#   docker build -f deploy/catalogue.Dockerfile -t fidelity-catalogue .

FROM node:24-alpine

WORKDIR /app

COPY catalogue/package.json catalogue/package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund

COPY catalogue/src ./src

# Two volumes: the builds, kept; the dump files, deleted as they are loaded.
# A 12 GB download and a file that starts at 8 GB — keep them on real disk.
ENV CATALOGUE_DATA=/data \
    CATALOGUE_SCRATCH=/scratch \
    SQLITE_TMPDIR=/scratch
VOLUME /data /scratch

RUN mkdir -p /data /scratch && chown -R node:node /data /scratch
USER node

# The job is its own health: status.json says what the last run did.
CMD ["node", "src/etl/run.ts"]
