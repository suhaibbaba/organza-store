FROM node:22-slim
WORKDIR /app

COPY shared ./shared
COPY pos ./pos

WORKDIR /app/pos

ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_DEFAULT_LOCALE
ARG NEXT_PUBLIC_SUPPORTED_LOCALES
ARG NEXT_PUBLIC_PROJECT_NAME
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
    NEXT_PUBLIC_DEFAULT_LOCALE=$NEXT_PUBLIC_DEFAULT_LOCALE \
    NEXT_PUBLIC_SUPPORTED_LOCALES=$NEXT_PUBLIC_SUPPORTED_LOCALES \
    NEXT_PUBLIC_PROJECT_NAME=$NEXT_PUBLIC_PROJECT_NAME

RUN npm ci

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
