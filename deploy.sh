#!/usr/bin/env bash
# /opt/organza/sandbox/deploy.sh  — called by GitHub Actions over SSH
set -euo pipefail
cd /opt/organza/sandbox

echo "==> Pulling latest 'sandbox' branch"
git fetch origin sandbox
git reset --hard origin/sandbox   # note: does NOT delete .env.sandbox (untracked)

echo "==> Building + starting containers"
docker compose -f docker-compose.sandbox.yml --env-file .env.sandbox up -d --build

echo "==> Applying database migrations"
sleep 5
docker compose -f docker-compose.sandbox.yml --env-file .env.sandbox \
  exec -T backend npx prisma migrate deploy

echo "==> Seeding database (idempotent)"
docker compose -f docker-compose.sandbox.yml --env-file .env.sandbox \
  exec -T backend npm run seed
  
echo "==> Pruning old images"
docker image prune -f
echo "==> Done."
