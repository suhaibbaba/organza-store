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
# The repo is one npm workspace, so the install runs from /app — the workspace
# root — against the single root lockfile, and "-w backend" narrows it to this
# app's dependency tree (plus shared/, which it links). backend/node_modules
# still gets the packages that cannot hoist, notably zod 3 where admin/pos want
# zod 4.
#
# All four workspace manifests have to be present even though only one app is
# installed: "npm ci" validates the root lockfile against every workspace
# declared in the root package.json, and would refuse the install with any of
# them missing. The trade-off is that bumping a dependency in admin/ or pos/
# invalidates this layer too — the price of one lockfile, and still far cheaper
# than reinstalling on every source edit.
#
# Beyond the manifests, only two things belong up here: shared/, because it is
# a real dependency now and its own "prepare" script compiles it during the
# install, and prisma/schema.prisma, because the backend's postinstall runs
# "prisma generate" against it. Nothing else does, which is the whole point —
# editing src/ must not land up here.
# (--ignore-scripts is not an option: it would skip both of those, leaving the
# Prisma client unbuilt and shared/dist absent.)
COPY package.json package-lock.json ./
COPY shared ./shared
COPY backend/package.json ./backend/
COPY admin/package.json ./admin/
COPY pos/package.json ./pos/
COPY backend/prisma ./backend/prisma

# install ALL deps (incl. prisma + tsx) before setting production env
RUN --mount=type=cache,target=/root/.npm npm ci -w backend

# --- source layer -----------------------------------------------------------
# node_modules is in .dockerignore, so this cannot clobber the install above —
# neither the hoisted /app/node_modules nor the nested /app/backend/node_modules.
COPY backend /app/backend

WORKDIR /app/backend
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
