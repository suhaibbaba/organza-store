#!/usr/bin/env bash
#
# Organza — put a backup back.
#
#   ./ops/restore.sh ./backups/organza-sandbox/20260808T221500Z
#
# DESTRUCTIVE. It overwrites the database in the running stack and adds the
# archived images back into the uploads volume. Like `db:reset`, it refuses to
# do that on a word: ORGANZA_RESTORE_CONFIRM has to be typed out in full.
#
#   ORGANZA_RESTORE_CONFIRM=I-KNOW-THIS-OVERWRITES-THE-DATABASE \
#     ./ops/restore.sh ./backups/organza-sandbox/20260808T221500Z
#
# A backup that has never been restored is a hope, not a backup. Rehearse this
# on the sandbox — that is what the sandbox is for.
set -euo pipefail

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.sandbox.yml}"
ENV_FILE="${ENV_FILE:-.env.sandbox}"
CONFIRM_PHRASE="I-KNOW-THIS-OVERWRITES-THE-DATABASE"
SRC="${1:-}"

compose() { docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" "$@"; }
die() { echo "  ✖ $*" >&2; exit 1; }

[ -n "$SRC" ]          || die "usage: ./ops/restore.sh <backup directory>"
[ -d "$SRC" ]          || die "no such backup directory: $SRC"
[ -f "$SRC/db.dump" ]  || die "no db.dump in $SRC"
[ -f "$COMPOSE_FILE" ] || die "no $COMPOSE_FILE here. cd to the directory that holds it."

env_path="$ENV_FILE"
case "$env_path" in /*) ;; *) env_path="./$env_path" ;; esac
# shellcheck disable=SC1090
set -a; . "$env_path"; set +a
: "${DB_USER:?not set in $ENV_FILE}"
: "${DB_NAME:?not set in $ENV_FILE}"

if [ "${ORGANZA_RESTORE_CONFIRM:-}" != "$CONFIRM_PHRASE" ]; then
  cat >&2 <<EOF

══════════════════════════════════════════════════════════════════
  ⛔  REFUSING TO RESTORE
══════════════════════════════════════════════════════════════════
  From     : $SRC
  Onto     : database "$DB_NAME" in $COMPOSE_FILE
             and the uploads volume behind /app/uploads

  This REPLACES the database that is there now. Every order, every
  product and every account entered since that backup was taken is
  gone, and there is no undo.

  If that is what you mean, say so in full:

      ORGANZA_RESTORE_CONFIRM=$CONFIRM_PHRASE \\
        ./ops/restore.sh $SRC

  Take a backup of what is there NOW first (./ops/backup.sh) —
  even if you are sure. Especially if you are sure.
══════════════════════════════════════════════════════════════════

EOF
  exit 1
fi

echo "==> Restoring database $DB_NAME"
# --clean --if-exists is baked into the dump; -1 wraps it in one transaction so
# a dump that fails halfway leaves the database as it was rather than half
# replaced. --no-owner because the roles in a restored dump need not exist here.
compose exec -T db pg_restore -U "$DB_USER" -d "$DB_NAME" --clean --if-exists --no-owner -1 < "$SRC/db.dump"

if [ -f "$SRC/uploads.tar.gz" ]; then
  echo "==> Restoring uploaded images into /app/uploads"
  # Unpacked INTO /app, because the archive's root entry is `uploads/` (see
  # backup.sh) — so the files land back at /app/uploads, on the volume.
  #
  # Copied OVER what is there rather than replacing the directory: a photo
  # uploaded after the backup was taken is somebody's work, and nothing here
  # is entitled to delete it. Files with the same name are overwritten by the
  # archived copy, which is what "restore" means.
  gunzip -c "$SRC/uploads.tar.gz" | compose cp -a - backend:/app
else
  echo "==> No uploads.tar.gz in this backup — skipping images"
fi

echo "==> Restarting the API so it re-reads what it has"
compose restart backend >/dev/null

echo ""
echo "  ✔ Restored from $SRC"
echo "    Check it: open the admin, load a product with a photo, and confirm"
echo "    the image renders (not the placeholder)."
