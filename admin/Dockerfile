# Two stages: build, then a runtime holding only Next's standalone bundle; context is the repo root.

########################  stage 1 — build  ####################################
FROM node:22-slim AS build
WORKDIR /app

# All workspace manifests are needed: npm ci validates the root lockfile against every declared workspace.
COPY package.json package-lock.json .npmrc ./
COPY shared ./shared
# @store/ui ships TypeScript source; Next compiles it into this app at build.
COPY ui ./ui
COPY backend/package.json ./backend/
COPY admin/package.json ./admin/
COPY pos/package.json ./pos/

RUN --mount=type=cache,target=/root/.npm npm ci -w admin

COPY admin /app/admin

# Inlined by next build, so declared after npm ci: changing one rebuilds the app without a reinstall.
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_DEFAULT_LOCALE
ARG NEXT_PUBLIC_SUPPORTED_LOCALES
ARG NEXT_PUBLIC_PROJECT_NAME
ARG NEXT_PUBLIC_APP_NAME
# Decides the icon folder, the "(SBX)" name and the SANDBOX chip — baked into the bundle, so a build arg.
ARG NEXT_PUBLIC_APP_ENV
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
    NEXT_PUBLIC_DEFAULT_LOCALE=$NEXT_PUBLIC_DEFAULT_LOCALE \
    NEXT_PUBLIC_SUPPORTED_LOCALES=$NEXT_PUBLIC_SUPPORTED_LOCALES \
    NEXT_PUBLIC_PROJECT_NAME=$NEXT_PUBLIC_PROJECT_NAME \
    NEXT_PUBLIC_APP_NAME=$NEXT_PUBLIC_APP_NAME \
    NEXT_PUBLIC_APP_ENV=$NEXT_PUBLIC_APP_ENV

# Resolved by the deploy on the host: .git is not in the build context, so there is nothing to count here.
ARG NEXT_PUBLIC_APP_VERSION
ENV NEXT_PUBLIC_APP_VERSION=$NEXT_PUBLIC_APP_VERSION

RUN npm run build -w admin

########################  stage 2 — runtime  ##################################
FROM node:22-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production

# The bundle is laid out from the workspace root (entrypoint admin/server.js); public/ and static are not traced.
COPY --from=build --chown=node:node /app/admin/.next/standalone ./
COPY --from=build --chown=node:node /app/admin/.next/static ./admin/.next/static
COPY --from=build --chown=node:node /app/admin/public ./admin/public

# next/image writes .next/cache at run time; it must belong to the unprivileged user or images stop rendering.
RUN mkdir -p /app/admin/.next/cache && chown -R node:node /app/admin/.next
USER node

# Re-declared at run time because server-side code reads some of them from process.env.
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

CMD ["node", "admin/server.js"]
