# backend/Dockerfile  — matches scripts: build (tsc) -> start (node dist/index.js)
FROM node:20-slim
# openssl needed by Prisma; keep image simple (fine for sandbox)
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app

# install ALL deps (incl. prisma + tsx) before setting production env
COPY package*.json ./
RUN npm ci

COPY . .
RUN npx prisma generate && npm run build

ENV NODE_ENV=production
EXPOSE 4000
CMD ["npm", "run", "start"]
