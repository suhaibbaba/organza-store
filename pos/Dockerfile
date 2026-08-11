# Build context is the repo root (see docker-compose.sandbox.yml).
#
# Split in two on purpose: a dependency layer, then a source layer. Docker
# caching is sequential, so copying all of pos/ before "npm ci" made every
# source edit reinstall node_modules and write a fresh ~1 GB layer into the
# build cache — three apps' worth, every push, until the disk filled. Only the
# files "npm ci" actually needs go above it; everything else lands after.
FROM node:22-slim
WORKDIR /app

# --- dependency layer -------------------------------------------------------
# The repo is one npm workspace, so the install runs from /app — the workspace
# root — against the single root lockfile, and "-w pos" narrows it to this
# app's dependency tree. The backend's dependencies (prisma, sharp, ...) stay
# out of this image.
#
# All four workspace manifests have to be present even though only one app is
# installed: "npm ci" validates the root lockfile against every workspace
# declared in the root package.json, and would refuse the install with any of
# them missing. The trade-off is that bumping a dependency in backend/ or
# admin/ invalidates this layer too — the price of one lockfile, and still far
# cheaper than reinstalling on every source edit.
#
# shared/ is up here because it is a real dependency now and its own "prepare"
# script compiles it during the install; the app also reads
# shared/scripts/app-version.js at build time from next.config.ts. Nothing else
# belongs above the install.
# (--ignore-scripts is not an option: it would skip that "prepare" and leave
# shared/dist absent, so nothing the app imports would resolve.)
COPY package.json package-lock.json ./
COPY shared ./shared
COPY backend/package.json ./backend/
COPY admin/package.json ./admin/
COPY pos/package.json ./pos/

RUN --mount=type=cache,target=/root/.npm npm ci -w pos

# --- source layer -----------------------------------------------------------
# node_modules is in .dockerignore, so this cannot clobber the install above.
COPY pos /app/pos

WORKDIR /app/pos

# Inlined into the bundle by next build, so they belong to the build, not the
# install — declared after "npm ci" so that editing e.g. the locale list
# rebuilds the app without dragging a full dependency reinstall along with it.
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_DEFAULT_LOCALE
ARG NEXT_PUBLIC_SUPPORTED_LOCALES
ARG NEXT_PUBLIC_PROJECT_NAME
# Sandbox or production. Decides which public/app_icon/<env>/ folder every
# icon path points at, whether the installed app is called "(SBX)", and
# whether the SANDBOX chip appears in the top bar. A build arg rather than a
# runtime variable because all three are baked into the bundle and the static
# HTML — `next start` reading it later would be too late.
ARG NEXT_PUBLIC_APP_ENV
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
    NEXT_PUBLIC_DEFAULT_LOCALE=$NEXT_PUBLIC_DEFAULT_LOCALE \
    NEXT_PUBLIC_SUPPORTED_LOCALES=$NEXT_PUBLIC_SUPPORTED_LOCALES \
    NEXT_PUBLIC_PROJECT_NAME=$NEXT_PUBLIC_PROJECT_NAME \
    NEXT_PUBLIC_APP_ENV=$NEXT_PUBLIC_APP_ENV

# The version staff read out when they report a problem, inlined into the
# bundle by next.config.ts. Resolved by the deploy on the host and passed in
# here because .dockerignore keeps .git out of the build context — there is no
# history in the image to count commits from (shared/scripts/app-version.js).
# Declared after `npm ci` on purpose: it changes on every deploy, and it must
# not drag a full dependency reinstall along with it.
ARG NEXT_PUBLIC_APP_VERSION
ENV NEXT_PUBLIC_APP_VERSION=$NEXT_PUBLIC_APP_VERSION

RUN npm run build

ENV NODE_ENV=production
EXPOSE 3000
CMD ["npm", "run", "start"]
