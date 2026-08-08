#!/usr/bin/env bash
#
# Organza — back up the two things that cannot be rebuilt from git:
# the database, and the uploaded product photographs.
#
#   ./ops/backup.sh                      # -> ./backups/<stack>/<timestamp>/
#   ./ops/backup.sh /srv/organza-backups # somewhere else
#
# Run it ON THE VPS, from the directory holding the compose file, with the
# stack up. It goes through the RUNNING containers — pg_dump inside the db
# container, and `compose cp` (which the Docker daemon performs) for the
# uploads volume — so it needs no extra image, no knowledge of Docker's
# generated volume names, and no direct access to /var/lib/docker.
#
# A volume protects the shop from a redeploy. It does not protect it from the
# disk dying, from `docker compose down -v`, or from `db:reset` typed in the
# wrong terminal. This does — but only if the copies end up somewhere else;
# see ops/README.md, "Off the box".
set -euo pipefail

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.sandbox.yml}"
ENV_FILE="${ENV_FILE:-.env.sandbox}"
DEST_ROOT="${1:-./backups}"
# Sortable, and it survives being copied somewhere with a stricter filesystem.
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"

compose() { docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" "$@"; }

die() { echo "  ✖ $*" >&2; exit 1; }

[ -f "$COMPOSE_FILE" ] || die "no $COMPOSE_FILE here. cd to the directory that holds it, or set COMPOSE_FILE."
[ -f "$ENV_FILE" ]     || die "no $ENV_FILE here. Set ENV_FILE if it lives elsewhere."

# The database name and user come from the same file the stack runs on, so a
# backup can never quietly dump the wrong database. Sourced through a path
# that always has a directory in it, so a bare filename is never looked up on
# PATH.
env_path="$ENV_FILE"
case "$env_path" in /*) ;; *) env_path="./$env_path" ;; esac
# shellcheck disable=SC1090
set -a; . "$env_path"; set +a
: "${DB_USER:?not set in $ENV_FILE}"
: "${DB_NAME:?not set in $ENV_FILE}"

# The compose project name, which is also the prefix Docker puts on the
# volumes — worth recording next to the copies so a restore knows what it is
# looking at.
STACK="$(compose config --format json 2>/dev/null | sed -n 's/^[[:space:]]*"name":[[:space:]]*"\([^"]*\)".*/\1/p' | head -n 1 || true)"
STACK="${STACK:-organza}"
DEST="$DEST_ROOT/$STACK/$STAMP"
mkdir -p "$DEST"

echo "══════════════════════════════════════════════════════════════════"
echo "  Organza backup"
echo "  Stack : $STACK  ($COMPOSE_FILE)"
echo "  Into  : $DEST"
echo "══════════════════════════════════════════════════════════════════"

# --- database -------------------------------------------------------------
# --clean --if-exists so the dump can be replayed over an existing database
# without hand-dropping it first; -Fc (custom format) so pg_restore can be
# selective and so it compresses itself.
echo "==> Database ($DB_NAME)"
compose exec -T db pg_dump -U "$DB_USER" -d "$DB_NAME" --clean --if-exists -Fc > "$DEST/db.dump.part"
mv "$DEST/db.dump.part" "$DEST/db.dump"

# --- uploads --------------------------------------------------------------
# Read out of the backend container, which is where the volume is mounted —
# /app/uploads is the path compose sets UPLOAD_DIR to, so these are exactly
# the files the API serves.
#
# `compose cp <service>:<path> -` streams a tar to stdout, built by the Docker
# daemon rather than by anything inside the image: no tar, no gzip and no
# shell are needed in the container, so this keeps working if the backend
# image is ever slimmed down. The archive's root entry is `uploads/`, which is
# what lets restore.sh unpack it straight into /app.
echo "==> Uploaded images (/app/uploads)"
compose cp -a backend:/app/uploads - | gzip > "$DEST/uploads.tar.gz.part"
mv "$DEST/uploads.tar.gz.part" "$DEST/uploads.tar.gz"

# --- prove it is readable --------------------------------------------------
# A backup nobody has opened is a guess. These are cheap and catch the two
# ways this silently produces rubbish: a truncated stream, and an empty
# archive from a mount that was not there.
echo "==> Checking the copies"
compose exec -T db pg_restore --list /dev/stdin < "$DEST/db.dump" > /dev/null \
  || die "the database dump is not readable by pg_restore — do not trust this backup"
tar -tzf "$DEST/uploads.tar.gz" > /dev/null \
  || die "the uploads archive is not readable — do not trust this backup"

IMAGE_COUNT="$(tar -tzf "$DEST/uploads.tar.gz" | grep -c '\.webp$' || true)"
echo "    database dump : $(du -h "$DEST/db.dump" | cut -f1)"
echo "    uploads       : $(du -h "$DEST/uploads.tar.gz" | cut -f1)  ($IMAGE_COUNT image file(s))"

if [ "$IMAGE_COUNT" = "0" ]; then
  # Not a failure — a shop with no photos yet is a real state. But it is also
  # exactly what a broken mount looks like, so it is said out loud rather than
  # left to be discovered during a restore.
  echo "    ⚠  no .webp files in the uploads volume. Fine if nothing has been"
  echo "       uploaded yet — otherwise check that UPLOAD_DIR still matches the"
  echo "       mount in $COMPOSE_FILE."
fi

echo "$STAMP  stack=$STACK  db=$DB_NAME  images=$IMAGE_COUNT" >> "$DEST_ROOT/backup.log"

echo ""
echo "  ✔ Done: $DEST"
echo "    Copy it OFF this machine — a backup on the same disk only survives"
echo "    the mistakes, not the disk. See ops/README.md."
