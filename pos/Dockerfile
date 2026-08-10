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
# postinstall runs build:shared, so the sibling shared/ package and the script
# that compiles it must exist before "npm ci". Nothing else does.
COPY shared ./shared
COPY pos/package.json pos/package-lock.json ./pos/
COPY pos/scripts ./pos/scripts

WORKDIR /app/pos
RUN --mount=type=cache,target=/root/.npm npm ci

# --- source layer -----------------------------------------------------------
# node_modules is in .dockerignore, so this cannot clobber the install above.
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
# Declared after `npm ci` on purpose: it changes on every deploy, and it must
# not drag a full dependency reinstall along with it.
ARG NEXT_PUBLIC_APP_VERSION
ENV NEXT_PUBLIC_APP_VERSION=$NEXT_PUBLIC_APP_VERSION

RUN npm run build

ENV NODE_ENV=production
EXPOSE 3000
CMD ["npm", "run", "start"]
