# backend/Dockerfile — three stages: build (compile), prod-deps (production
# dependency tree), runtime (what actually ships).
# Build context is the repo root (see docker-compose.sandbox.yml).
#
# The single-stage image this replaced shipped everything it had ever needed:
# the TypeScript compiler, vitest, the full source tree and a ~944 MB
# node_modules, around 1.5 GB in total. Three apps' worth of that filled the
# VPS disk. Only the last stage becomes the image; the first two are discarded.
#
# The layer-caching discipline is unchanged and still the point: in every stage
# that installs, only the manifests and the shared package go above "npm ci",
# so editing src/ never reinstalls node_modules.

########################  stage 1 — build  ####################################
FROM node:20-slim AS build
# openssl is what Prisma's engines link against; needed here to generate.
RUN apt-get update && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app

# .npmrc carries legacy-peer-deps, which is what keeps better-auth's optional
# peers (Next.js, vitest) out of the API's dependency tree. It has to be here
# before "npm ci", and it has to match the .npmrc the lockfile was resolved
# with, or the install and the lockfile disagree.
COPY package.json package-lock.json .npmrc ./
COPY shared ./shared
COPY backend/package.json ./backend/
COPY admin/package.json ./admin/
COPY pos/package.json ./pos/
COPY backend/prisma ./backend/prisma
RUN --mount=type=cache,target=/root/.npm npm ci -w backend

COPY backend /app/backend
RUN npm run build -w backend

########################  stage 2 — production dependencies  ##################
# A second, independent install rather than a prune of stage 1: `npm prune
# --omit=dev` deletes the dev packages first and only then re-runs the shared
# package's `prepare`, which needs the TypeScript it has just removed, so the
# prune fails. Installing production-only from the start avoids that entirely.
#
# Only shared/package.json and its prepare script are copied — deliberately not
# src/. With no sources present that script is a no-op (see it for why), which
# is what we want here: dist/ comes out of stage 1, already compiled, and this
# stage has no TypeScript to compile it with.
FROM node:20-slim AS prod-deps
RUN apt-get update && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app

COPY package.json package-lock.json .npmrc ./
COPY shared/package.json ./shared/
COPY shared/scripts/prepare.js ./shared/scripts/
COPY backend/package.json ./backend/
COPY admin/package.json ./admin/
COPY pos/package.json ./pos/
# prisma/schema.prisma has to be here: --omit=dev still runs the backend's
# postinstall, and that postinstall is `prisma generate`. This is why `prisma`
# is a runtime dependency and not dev tooling (see backend/package.json) — with
# it omitted, the production install could not generate its own client.
COPY backend/prisma ./backend/prisma
RUN --mount=type=cache,target=/root/.npm npm ci -w backend --omit=dev

########################  stage 3 — runtime  ##################################
FROM node:20-slim AS runtime
# Prisma's query engine is a native binary that links libssl at run time, not
# just at generate time. Leaving openssl out here is the classic "worked in the
# build, dies on the first query" failure.
RUN apt-get update && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NODE_ENV=production

# The production dependency tree, whole, rather than a list of node_modules
# paths — because there is more than one and the set is npm's to decide. npm
# hoists what it can to /app/node_modules, but zod cannot hoist: better-auth
# pulls zod 4 while the API and the shared schemas are written against zod 3,
# so npm nests a zod 3 under backend/ AND under shared/. Copy only the hoisted
# tree and the API silently validates against the wrong major version; name the
# nested ones explicitly instead and the build breaks the day npm hoists
# differently. Taking the stage whole is correct either way, and all it adds is
# the manifests and the lockfile it was installed from.
COPY --from=prod-deps /app ./

# Compiled output, over the top. node_modules/@organza/shared is a symlink to
# ../../shared, so the package's dist/ has to land at that path for every
# import to resolve; its package.json (and the `exports` map they all go
# through) came across with the stage above.
COPY --from=build /app/shared/dist ./shared/dist
COPY --from=build /app/backend/dist ./backend/dist

# Everything below this line is here for the deploy, which runs two commands
# inside this container after it starts (.github/workflows/deploy-sandbox.yml):
#
#   npx prisma migrate deploy   -> needs prisma/ (schema + migrations)
#   npm run bootstrap           -> tsx scripts/bootstrap.ts, which imports
#                                  @/lib/* — TypeScript source, resolved
#                                  through tsconfig.json's path aliases
#
# So the migrations, the scripts and src/ all ship (prisma/ already came across
# with the prod-deps stage, which needed the schema to generate). They are text
# and cost about a megabyte; dropping them would break the deploy, not slim it.
COPY --from=build /app/backend/scripts ./backend/scripts
COPY --from=build /app/backend/src ./backend/src
COPY --from=build /app/backend/tsconfig.json ./backend/tsconfig.json

# Run as the unprivileged `node` user that the base image already provides.
#
# UPLOAD_DIR (/app/uploads, set in docker-compose.sandbox.yml) is a named
# volume holding every photograph the shop owns. Creating it here owned by
# `node` is what makes a FRESH volume come out writable — Docker seeds a new
# empty volume from the image, ownership included. A volume that ALREADY has
# data in it is not re-seeded and keeps its existing root ownership, so the
# first deploy after this change has to chown it once; the deploy workflow does
# that, and /health reports uploadsWritable either way.
RUN mkdir -p /app/uploads && chown -R node:node /app/uploads
USER node

WORKDIR /app/backend
EXPOSE 4000

# Passed in by the deploy: .dockerignore keeps .git out of the build context,
# so the image cannot count commits itself (shared/scripts/app-version.js).
# Read at runtime, so it sits at the end where it cannot invalidate anything.
ARG APP_VERSION
ENV APP_VERSION=$APP_VERSION

CMD ["npm", "run", "start"]
