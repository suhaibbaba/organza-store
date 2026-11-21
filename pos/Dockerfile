# Two stages: build compiles, runtime ships only the standalone bundle; context is the repo root.

########################  stage 1 — build  ####################################
FROM node:22-slim AS build
WORKDIR /app

# All four workspace manifests are needed: npm ci checks the root lockfile against every declared workspace.
COPY package.json package-lock.json .npmrc ./
COPY shared ./shared
# @store/ui ships TypeScript source; Next compiles it into this app at build.
COPY ui ./ui
COPY backend/package.json ./backend/
COPY admin/package.json ./admin/
COPY pos/package.json ./pos/

RUN --mount=type=cache,target=/root/.npm npm ci -w pos

COPY pos /app/pos

# Declared after npm ci: these are inlined by next build, so changing one must not reinstall dependencies.
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_DEFAULT_LOCALE
ARG NEXT_PUBLIC_SUPPORTED_LOCALES
ARG NEXT_PUBLIC_PROJECT_NAME
ARG NEXT_PUBLIC_APP_NAME
# Build arg, not runtime: the icon folder, the "(SBX)" name and the SANDBOX chip are baked into the bundle.
ARG NEXT_PUBLIC_APP_ENV
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
    NEXT_PUBLIC_DEFAULT_LOCALE=$NEXT_PUBLIC_DEFAULT_LOCALE \
    NEXT_PUBLIC_SUPPORTED_LOCALES=$NEXT_PUBLIC_SUPPORTED_LOCALES \
    NEXT_PUBLIC_PROJECT_NAME=$NEXT_PUBLIC_PROJECT_NAME \
    NEXT_PUBLIC_APP_NAME=$NEXT_PUBLIC_APP_NAME \
    NEXT_PUBLIC_APP_ENV=$NEXT_PUBLIC_APP_ENV

# Passed in by the deploy: .dockerignore keeps .git out, so the image has no history to count commits from.
ARG NEXT_PUBLIC_APP_VERSION
ENV NEXT_PUBLIC_APP_VERSION=$NEXT_PUBLIC_APP_VERSION

RUN npm run build -w pos

########################  stage 2 — runtime  ##################################
FROM node:22-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production

# Standalone is laid out from the workspace root (pos/server.js); public/ and static assets are not traced.
COPY --from=build --chown=node:node /app/pos/.next/standalone ./
COPY --from=build --chown=node:node /app/pos/.next/static ./pos/.next/static
COPY --from=build --chown=node:node /app/pos/public ./pos/public

# next/image writes .next/cache at run time, so the unprivileged user must own it or photos stop rendering.
RUN mkdir -p /app/pos/.next/cache && chown -R node:node /app/pos/.next
USER node

# Re-declared at run time: some server code reads NEXT_PUBLIC_* straight from process.env.
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_DEFAULT_LOCALE
ARG NEXT_PUBLIC_SUPPORTED_LOCALES
ARG NEXT_PUBLIC_PROJECT_NAME
ARG NEXT_PUBLIC_APP_NAME
ARG NEXT_PUBLIC_APP_ENV
ARG NEXT_PUBLIC_APP_VERSION
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
    NEXT_PUBLIC_DEFAULT_LOCALE=$NEXT_PUBLIC_DEFAULT_LOCALE \
    NEXT_PUBLIC_SUPPORTED_LOCALES=$NEXT_PUBLIC_SUPPORTED_LOCALES \
    NEXT_PUBLIC_PROJECT_NAME=$NEXT_PUBLIC_PROJECT_NAME \
    NEXT_PUBLIC_APP_NAME=$NEXT_PUBLIC_APP_NAME \
    NEXT_PUBLIC_APP_ENV=$NEXT_PUBLIC_APP_ENV \
    NEXT_PUBLIC_APP_VERSION=$NEXT_PUBLIC_APP_VERSION

# Bound to localhost the server would answer nothing through the port mapping.
ENV PORT=3000 HOSTNAME=0.0.0.0
EXPOSE 3000

CMD ["node", "pos/server.js"]
