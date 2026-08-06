# backend/Dockerfile — matches scripts: build (tsc) -> start (node dist/index.js)
# Build context is the repo root (see docker-compose.sandbox.yml).
#
# Split in two on purpose: a dependency layer, then a source layer. Docker
# caching is sequential, so copying all of backend/ before "npm ci" made every
# source edit reinstall node_modules and write a fresh ~1 GB layer into the
# build cache — three apps' worth, every push, until the disk filled. Only the
# files "npm ci" actually needs go above it; everything else lands after.
FROM node:20-slim
# openssl needed by Prisma; keep image simple (fine for sandbox)
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app

# --- dependency layer -------------------------------------------------------
# postinstall runs "build:shared && prisma generate", so all three of these
# have to exist before "npm ci": the sibling shared/ package it compiles,
# scripts/build-shared.js that drives it, and prisma/schema.prisma. Nothing
# else does, which is the whole point — editing src/ must not land up here.
# (--ignore-scripts is not an option: it would skip dependency install scripts
# too and leave the Prisma client unbuilt.)
COPY shared ./shared
COPY backend/package.json backend/package-lock.json ./backend/
COPY backend/scripts ./backend/scripts
COPY backend/prisma ./backend/prisma

# install ALL deps (incl. prisma + tsx) before setting production env
WORKDIR /app/backend
RUN --mount=type=cache,target=/root/.npm npm ci

# --- source layer -----------------------------------------------------------
# node_modules is in .dockerignore, so this cannot clobber the install above.
COPY backend /app/backend

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
