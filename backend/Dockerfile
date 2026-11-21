# Three stages (build, prod-deps, runtime); only the runtime ships. Build context is the repo root.

########################  stage 1 — build  ####################################
FROM node:20-slim AS build
# openssl is what Prisma's engines link against; needed here to generate.
RUN apt-get update && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app

# .npmrc (legacy-peer-deps) must be here before npm ci and match the one the lockfile was resolved with.
COPY package.json package-lock.json .npmrc ./
COPY shared ./shared
COPY backend/package.json ./backend/
COPY admin/package.json ./admin/
COPY pos/package.json ./pos/
COPY ui/package.json ./ui/
COPY backend/prisma ./backend/prisma
RUN --mount=type=cache,target=/root/.npm npm ci -w backend

COPY backend /app/backend
RUN npm run build -w backend

# Stage 2: a fresh production-only install, since pruning stage 1 breaks shared's prepare (needs TypeScript).
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
COPY ui/package.json ./ui/
# --omit=dev still runs postinstall (prisma generate), so the schema must be here and prisma is a runtime dependency.
COPY backend/prisma ./backend/prisma
RUN --mount=type=cache,target=/root/.npm npm ci -w backend --omit=dev

########################  stage 3 — runtime  ##################################
FROM node:20-slim AS runtime
# Prisma's engine links libssl at run time; fonts-dejavu-core is the font numbered-shawl photos are drawn with.
RUN apt-get update && apt-get install -y --no-install-recommends openssl fonts-dejavu-core \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NODE_ENV=production

# The whole production tree, not hoisted paths: zod 3 is nested under backend/ and shared/ (better-auth hoists zod 4).
COPY --from=prod-deps /app ./

# node_modules/@store/shared symlinks to ../../shared, so its compiled dist/ must land at that path.
COPY --from=build /app/shared/dist ./shared/dist
COPY --from=build /app/backend/dist ./backend/dist

# The deploy runs prisma migrate deploy and npm run bootstrap (tsx + path aliases) here, so prisma/, scripts/ and src/ ship.
COPY --from=build /app/backend/scripts ./backend/scripts
COPY --from=build /app/backend/src ./backend/src
COPY --from=build /app/backend/tsconfig.json ./backend/tsconfig.json

# Runs as `node`; /app/uploads is created owned by it so a fresh uploads volume comes out writable.
RUN mkdir -p /app/uploads && chown -R node:node /app/uploads
USER node

WORKDIR /app/backend
EXPOSE 4000

# Passed in by the deploy (no .git in the context to count commits); last so it invalidates no layer.
ARG APP_VERSION
ENV APP_VERSION=$APP_VERSION

CMD ["npm", "run", "start"]
