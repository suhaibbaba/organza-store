#!/usr/bin/env bash
# Off-site backup of the database and photos to R2, failing loudly: STACK=production|sandbox ./ops/backup.sh [--local-only]
set -euo pipefail

OPS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=ops/common.sh
. "$OPS_DIR/common.sh"

DEST_ROOT="${BACKUP_DEST_ROOT:-./backups}"

# ~30 nightly dumps (a month) are kept in the bucket; the photo mirror is never pruned.
KEEP_DUMPS="${BACKUP_KEEP_DUMPS:-30}"

# Few local dumps: this disk is what the backup must survive, so they are a convenience, never the archive.
KEEP_LOCAL_DUMPS="${BACKUP_KEEP_LOCAL_DUMPS:-3}"

# Sortable, and it survives being copied somewhere with a stricter filesystem.
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
STARTED_AT="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
START_SECONDS="$(date -u +%s)"

LOCAL_ONLY=0
while [ $# -gt 0 ]; do
  case "$1" in
    --local-only) LOCAL_ONLY=1; shift ;;
    --stack)      STACK="${2:?--stack needs production or sandbox}"; shift 2 ;;
    --stack=*)    STACK="${1#*=}"; shift ;;
    *) echo "usage: ./ops/backup.sh [--stack production|sandbox] [--local-only]" >&2; exit 2 ;;
  esac
done

# On failure: banner, then Sentry + BackupRun row via backup:record, then non-zero exit for cron; reporting never masks the error.
report_run() {
  local status="$1"; shift
  compose exec -T backend npm run --silent backup:record -- --status="$status" "$@" \
    >/dev/null 2>&1 ||
    echo "  ⚠  could not reach the API container to record this run (the run itself stands)."
}

fail() {
  local stage="$1" message="$2"
  {
    echo ""
    echo "$RULE"
    echo "  ✖  BACKUP FAILED — stage: $stage"
    echo "$RULE"
    echo "  $message"
    echo ""
    echo "  The shop has NO fresh off-site copy tonight. See ops/README.md,"
    echo "  \"When a backup fails\"."
    echo "$RULE"
  } >&2

  report_run FAILED --stage="$stage" --started-at="$STARTED_AT" --error="$message"
  exit 1
}

# Anything the explicit checks miss is still reported; cleared on success.
CURRENT_STAGE="startup"
trap 'fail "$CURRENT_STAGE" "the script exited unexpectedly (see the output above)"' ERR

ops_load_env
DB_PREFIX="$(ops_db_prefix "$STACK_PROJECT")"
UPLOADS_PREFIX="$(ops_uploads_prefix "$STACK_PROJECT")"
# The project name already names the stack, so it is not repeated here.
DUMP_NAME="$STACK_PROJECT-$STAMP.dump"

DEST="$DEST_ROOT/$STACK_PROJECT/$STAMP"
mkdir -p "$DEST"
OPS_WORK_DIR="$DEST"

# Credentials are checked before the dump, not after ten minutes of compressing.
[ "$LOCAL_ONLY" = "1" ] || ops_require_r2

echo "$RULE"
echo "  Store Management backup — $(date -u +%Y-%m-%d\ %H:%M:%SZ)"
echo "$RULE"
ops_print_target
echo "  Local    : $DEST"
if [ "$LOCAL_ONLY" = "1" ]; then
  echo "  Off-site : SKIPPED (--local-only)"
else
  echo "  Off-site : s3://$R2_BUCKET/$STACK_PROJECT/  via $R2_ENDPOINT"
fi
echo "$RULE"

# Third guard: the running deployment must agree with STACK (warns when it cannot answer).
CURRENT_STAGE="stack-check"
ops_assert_stack_matches_app_env

# --clean --if-exists so it replays over an existing database; -Fc is selective and self-compressing.
CURRENT_STAGE="dump"
echo "==> Database ($DB_NAME)"
compose exec -T db pg_dump -U "$DB_USER" -d "$DB_NAME" --clean --if-exists -Fc -Z 9 \
  > "$DEST/db.dump.part" 2>"$DEST/dump.err" ||
  fail dump "pg_dump failed: $(tr '\n' ' ' < "$DEST/dump.err" | tail -c 400)"
mv "$DEST/db.dump.part" "$DEST/db.dump"
rm -f "$DEST/dump.err"

# Read the whole dump back before trusting it (see ops_verify_dump in ops/common.sh).
ops_verify_dump "$DEST/db.dump" ||
  fail dump "the dump is not readable by pg_restore — do not trust it. Nothing was uploaded."

DB_BYTES="$(wc -c < "$DEST/db.dump" | tr -d ' ')"
echo "    $DUMP_NAME — $(du -h "$DEST/db.dump" | cut -f1), readable by pg_restore ✓"

if [ "$LOCAL_ONLY" = "1" ]; then
  echo ""
  echo "  ✔ Local dump only: $DEST/db.dump"
  echo "    Nothing left this machine, so this is not yet a backup — it is a"
  echo "    safety net for the next few minutes. See ops/README.md."
  trap - ERR
  exit 0
fi

CURRENT_STAGE="upload"
echo "==> Uploading the dump to R2"
r2 s3 cp /work/db.dump "s3://$R2_BUCKET/$DB_PREFIX/$DUMP_NAME" --only-show-errors ||
  fail upload "could not upload the dump to s3://$R2_BUCKET/$DB_PREFIX/$DUMP_NAME"

# Ask the bucket what it holds: an empty upload exits 0 too.
REMOTE_BYTES="$(r2 s3api head-object --bucket "$R2_BUCKET" --key "$DB_PREFIX/$DUMP_NAME" \
  --query ContentLength --output text 2>/dev/null | tr -d '\r' || true)"
[ "$REMOTE_BYTES" = "$DB_BYTES" ] ||
  fail upload "the dump in R2 is ${REMOTE_BYTES:-missing} bytes but the local one is $DB_BYTES — the upload is incomplete."
echo "    s3://$R2_BUCKET/$DB_PREFIX/$DUMP_NAME ✓ ($REMOTE_BYTES bytes, verified against the local file)"

# Synced from the backend's own mount, deliberately without --delete, so an accidental photo deletion stays recoverable.
CURRENT_STAGE="images"
echo "==> Mirroring the uploaded images (incremental)"
r2 s3 sync /app/uploads "s3://$R2_BUCKET/$UPLOADS_PREFIX/" --only-show-errors ||
  fail images "the image sync to s3://$R2_BUCKET/$UPLOADS_PREFIX/ failed"

# Counted from the bucket: what is actually stored off-site is the number that matters.
SUMMARY="$(r2 s3 ls "s3://$R2_BUCKET/$UPLOADS_PREFIX/" --recursive --summarize 2>/dev/null | tail -n 3 || true)"
IMAGE_COUNT="$(printf '%s' "$SUMMARY" | sed -n 's/.*Total Objects: *\([0-9][0-9]*\).*/\1/p' | head -n 1)"
IMAGE_BYTES="$(printf '%s' "$SUMMARY" | sed -n 's/.*Total Size: *\([0-9][0-9]*\).*/\1/p' | head -n 1)"
IMAGE_COUNT="${IMAGE_COUNT:-0}"
IMAGE_BYTES="${IMAGE_BYTES:-0}"
echo "    s3://$R2_BUCKET/$UPLOADS_PREFIX/ ✓ ($IMAGE_COUNT file(s), $IMAGE_BYTES bytes in the bucket)"

if [ "$IMAGE_COUNT" = "0" ]; then
  # Not a failure, but it is also what a broken mount looks like, so say it.
  echo "    ⚠  the bucket holds no images at all. Fine if nothing has been uploaded"
  echo "       yet — otherwise check that UPLOAD_DIR still matches the mount in"
  echo "       $COMPOSE_FILE (docker compose logs backend | grep -i uploads)."
fi

CURRENT_STAGE="prune"
echo "==> Pruning old dumps (keeping $KEEP_DUMPS)"
ALL_DUMPS="$(ops_list_dumps "$DB_PREFIX")"
DUMP_TOTAL="$(printf '%s' "$ALL_DUMPS" | grep -c . || true)"

if [ "${DUMP_TOTAL:-0}" -gt "$KEEP_DUMPS" ]; then
  printf '%s\n' "$ALL_DUMPS" | head -n "-$KEEP_DUMPS" | while IFS= read -r key; do
    [ -n "$key" ] || continue
    r2 s3 rm "s3://$R2_BUCKET/$key" --only-show-errors ||
      fail prune "could not delete the old dump $key — the bucket will keep growing."
    echo "    removed $key"
  done
fi
echo "    bucket held $DUMP_TOTAL dump(s) before this run; keeping the newest $KEEP_DUMPS"

find "$DEST_ROOT/$STACK_PROJECT" -mindepth 1 -maxdepth 1 -type d 2>/dev/null | sort | head -n "-$KEEP_LOCAL_DUMPS" |
  while IFS= read -r old; do
    [ -n "$old" ] || continue
    rm -rf "$old"
    echo "    removed local $old"
  done

# Recorded twice: a file readable when nothing is up, and the row /health and backup:status read.
CURRENT_STAGE="record"
ELAPSED="$(( $(date -u +%s) - START_SECONDS ))"
echo "$STAMP  stack=$STACK  project=$STACK_PROJECT  compose=$COMPOSE_FILE  env=$ENV_FILE  db=$DB_NAME  dump=$DB_BYTES bytes  images=$IMAGE_COUNT  ${ELAPSED}s" \
  >> "$DEST_ROOT/backup.log"
printf '%s  s3://%s/%s/%s\n' "$STAMP" "$R2_BUCKET" "$DB_PREFIX" "$DUMP_NAME" \
  > "$DEST_ROOT/last-success.txt"

report_run SUCCEEDED \
  --started-at="$STARTED_AT" \
  --database-bytes="$DB_BYTES" \
  --image-count="$IMAGE_COUNT" \
  --image-bytes="$IMAGE_BYTES" \
  --destination="s3://$R2_BUCKET/$STACK_PROJECT"

trap - ERR
echo ""
echo "$RULE"
echo "  ✔ Backed up STACK=$STACK ($DB_NAME, via $COMPOSE_FILE + $ENV_FILE) in ${ELAPSED}s"
echo "    database : s3://$R2_BUCKET/$DB_PREFIX/$DUMP_NAME  ($DB_BYTES bytes)"
echo "    images   : s3://$R2_BUCKET/$UPLOADS_PREFIX/  ($IMAGE_COUNT file(s))"
echo "    restore  : ./ops/restore.sh --list — and rehearse it on the sandbox first."
echo "$RULE"
