# backend/Dockerfile — matches scripts: build (tsc) -> start (node dist/index.js)
# Build context is the repo root (see docker-compose.sandbox.yml): "npm ci"
# runs postinstall, which needs prisma/schema.prisma (for "prisma generate")
# and scripts/build-shared.js, which itself builds the sibling ../shared
# package. All of that must exist before "npm ci" runs, so source is copied
# in up front rather than package.json-first for layer caching.
FROM node:20-slim
# openssl needed by Prisma; keep image simple (fine for sandbox)
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app

COPY shared ./shared
COPY backend ./backend

# install ALL deps (incl. prisma + tsx) before setting production env
WORKDIR /app/backend
RUN npm ci

RUN npm run build

# Which build of the API is running, served by GET /api/version. Passed in by
# the deploy for the same reason the frontends' version is: .dockerignore keeps
# .git out of the build context, so the image cannot count commits itself
# (shared/scripts/app-version.js). Read at runtime, so it sits after the build
# where it can't invalidate the install/compile layers.
ARG APP_VERSION
ENV APP_VERSION=$APP_VERSION

ENV NODE_ENV=production
EXPOSE 4000
CMD ["npm", "run", "start"]
