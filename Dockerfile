# syntax=docker/dockerfile:1

FROM node:22-bookworm-slim

# Prisma's query engine needs openssl at runtime.
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000

WORKDIR /app

COPY . .

# Workspace builds need typescript/prisma, which NODE_ENV=production would skip.
RUN npm ci --include=dev

RUN npm run prisma:generate -w db

# Several franchise pages are prerendered at build time and read the database,
# so build against a throwaway SQLite file rather than the mounted volume.
ENV DATABASE_URL="file:/tmp/build.db"
RUN npm run migrate -w db && npm run build

ENV DATABASE_URL="file:/data/tipoff.db"

EXPOSE 3000

ENTRYPOINT ["/app/deploy/entrypoint.sh"]
