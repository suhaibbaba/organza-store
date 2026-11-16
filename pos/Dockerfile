# pos/Dockerfile — two stages: build (compile), runtime (what actually ships).
# Build context is the repo root (see docker-compose.sandbox.yml).
#
# The single-stage image this replaced carried the whole workspace: source,
# devDependencies, the full ~500 MB node_modules and the entire .next
# directory, around 1.5 GB. Next's `output: "standalone"` (pos/next.config.ts)
# emits a server bundle with only the files the app actually reaches — about
# 80 MB — and that plus public/ and the static assets is the entire runtime.
#
# The layer-caching discipline is unchanged and still the point: only the
# manifests and the shared package go above "npm ci", so editing src/ never
# reinstalls node_modules.

########################  stage 1 — build  ####################################
FROM node:22-slim AS build
WORKDIR /app

# .npmrc carries legacy-peer-deps and has to match the .npmrc the lockfile was
# resolved with, or the install and the lockfile disagree.
#
# All four workspace manifests are needed even though only this app installs:
# "npm ci" validates the root lockfile against every workspace declared in the
# root package.json and refuses the install with any of them missing.
COPY package.json package-lock.json .npmrc ./
COPY shared ./shared
COPY backend/package.json ./backend/
COPY admin/package.json ./admin/
COPY pos/package.json ./pos/

RUN --mount=type=cache,target=/root/.npm npm ci -w pos

COPY pos /app/pos

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
ARG NEXT_PUBLIC_APP_VERSION
ENV NEXT_PUBLIC_APP_VERSION=$NEXT_PUBLIC_APP_VERSION

RUN npm run build -w pos

########################  stage 2 — runtime  ##################################
FROM node:22-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production

# outputFileTracingRoot is the workspace root, so the bundle is laid out
# relative to it: node_modules/ at the top and the app under pos/, with
# pos/server.js as the entrypoint. Copying it to /app therefore reproduces
# the workspace layout the build had, minus everything unreachable.
#
# The two things standalone deliberately does NOT trace, because they are
# served rather than imported, have to come across separately.
COPY --from=build --chown=node:node /app/pos/.next/standalone ./
COPY --from=build --chown=node:node /app/pos/.next/static ./pos/.next/static
COPY --from=build --chown=node:node /app/pos/public ./pos/public

# next/image writes optimized variants to .next/cache at RUN time — the first
# product photo requested creates it. As an unprivileged user against a
# root-owned .next that write fails and images stop rendering, which is a
# miserable thing to discover in production, so the directory is created and
# handed over here rather than left to chance.
RUN mkdir -p /app/pos/.next/cache && chown -R node:node /app/pos/.next
USER node

# The NEXT_PUBLIC_* values are already inlined into the bundle above, but the
# single-stage image this replaced also had them set as environment variables
# at run time, and server-side code reads some of them straight from
# process.env. Re-declaring them keeps runtime behaviour identical rather than
# subtly different for anything not inlined at build time.
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_DEFAULT_LOCALE
ARG NEXT_PUBLIC_SUPPORTED_LOCALES
ARG NEXT_PUBLIC_PROJECT_NAME
ARG NEXT_PUBLIC_APP_ENV
ARG NEXT_PUBLIC_APP_VERSION
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
    NEXT_PUBLIC_DEFAULT_LOCALE=$NEXT_PUBLIC_DEFAULT_LOCALE \
    NEXT_PUBLIC_SUPPORTED_LOCALES=$NEXT_PUBLIC_SUPPORTED_LOCALES \
    NEXT_PUBLIC_PROJECT_NAME=$NEXT_PUBLIC_PROJECT_NAME \
    NEXT_PUBLIC_APP_ENV=$NEXT_PUBLIC_APP_ENV \
    NEXT_PUBLIC_APP_VERSION=$NEXT_PUBLIC_APP_VERSION

# The standalone server reads both (it defaults HOSTNAME to 0.0.0.0, but say
# it out loud: bound to localhost it would answer nothing through the port
# mapping, and that failure looks like the container being broken).
ENV PORT=3000 HOSTNAME=0.0.0.0
EXPOSE 3000

CMD ["node", "pos/server.js"]
