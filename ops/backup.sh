#!/usr/bin/env bash
#
# Organza — back up the two things that cannot be rebuilt from git, TO ANOTHER
# COMPANY'S DISK: the database, and the uploaded product photographs.
#
#   ./ops/backup.sh                 # the nightly run (cron calls this)
#   ./ops/backup.sh --local-only    # dump to this disk and stop; no upload
#
# Run it ON THE VPS, from the directory holding the compose file, with the
# stack up. Everything that touches the shop's data goes through the RUNNING
# containers — pg_dump inside the db container, the photographs read out of
# the backend container's own mount — so it needs no database password on the
# command line, no knowledge of Docker's generated volume names, and no access
# to /var/lib/docker.
#
# WHAT IT PRODUCES
#   s3://$R2_BUCKET/<stack>/database/<stack>-<stamp>.dump          (pg_dump -Fc)
#   s3://$R2_BUCKET/<stack>/uploads/…                               (mirror of the volume)
#   ./backups/<stack>/<stamp>/db.dump                               (the local copy it made)
#
# The images are SYNCED, not re-uploaded: a photograph already in the bucket
# at the same size and time is skipped, so the nightly cost is the handful of
# pictures taken that day rather than the whole shop. The database has no such
# luxury — a dump is one opaque object and is written whole.
#
# WHY OFF THE BOX
#   A volume protects the shop from a redeploy. It does not protect it from
#   the disk dying, from `docker compose down -v`, or from `db:reset` typed
#   into the wrong terminal. A copy in ./backups protects it from the second
#   two and not the first: one disk failure destroys the shop's data and the
#   backup of it together. That is why this ends in somebody else's building.
#
# IT FAILS LOUDLY
#   Every stage that can break is checked, and a failure prints a banner, is
#   filed to Sentry through the API's own error-tracking layer, and exits
#   non-zero so cron mails it. A backup that quietly does nothing is worse
#   than no backup, because it is believed.
set -euo pipefail

OPS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=ops/common.sh
. "$OPS_DIR/common.sh"

# ---------------------------------------------------------------------------
#  Configuration
# ---------------------------------------------------------------------------
DEST_ROOT="${BACKUP_DEST_ROOT:-./backups}"

# How many nightly dumps live in the bucket. ~30 is a month: long enough that
# damage done quietly (a bad import, a deletion nobody noticed) is still
# recoverable, short enough that the storage bill is a rounding error. The
# image mirror is NOT pruned — see the sync stage for why.
KEEP_DUMPS="${BACKUP_KEEP_DUMPS:-30}"

# How many dumps stay on the VPS itself. Small on purpose: this disk is the
# one the backup exists to survive, so its copies are a convenience (a fast
# restore, a rehearsal) and never the archive.
KEEP_LOCAL_DUMPS="${BACKUP_KEEP_LOCAL_DUMPS:-3}"

# Sortable, and it survives being copied somewhere with a stricter filesystem.
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
STARTED_AT="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
START_SECONDS="$(date -u +%s)"

LOCAL_ONLY=0
for arg in "$@"; do
  case "$arg" in
    --local-only) LOCAL_ONLY=1 ;;
    *) echo "usage: ./ops/backup.sh [--local-only]" >&2; exit 2 ;;
  esac
done

# ---------------------------------------------------------------------------
#  Failing loudly
# ---------------------------------------------------------------------------
# Three things happen, in this order, and the order matters:
#   1. it is said on the terminal / in the cron log, in a banner;
#   2. it is filed to Sentry through the API's logging layer (CLAUDE.md rule
#      20) — nothing here imports Sentry, it goes via `npm run backup:record`
#      inside the backend container, which is also what writes the BackupRun
#      row that /health and `npm run backup:status` read;
#   3. it exits non-zero, so cron mails the output and any monitor notices.
#
# Reporting is best-effort and must never mask the original failure: if the
# backend container is the thing that is down, the message it could not
# deliver is already on stdout above, where cron will find it.
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

# Anything that escapes the explicit checks below — a typo, a signal, a `set
# -e` trip somewhere nobody predicted — is still reported, rather than leaving
# behind a run that merely stopped. Cleared on the success path.
CURRENT_STAGE="startup"
trap 'fail "$CURRENT_STAGE" "the script exited unexpectedly (see the output above)"' ERR

# ---------------------------------------------------------------------------
#  Where, and as whom
# ---------------------------------------------------------------------------
ops_load_env
STACK="$(ops_resolve_stack)"
DB_PREFIX="$(ops_db_prefix "$STACK")"
UPLOADS_PREFIX="$(ops_uploads_prefix "$STACK")"
# The stack name already carries the "organza-" prefix (it is the compose
# project name), so it is not repeated here.
DUMP_NAME="$STACK-$STAMP.dump"

DEST="$DEST_ROOT/$STACK/$STAMP"
mkdir -p "$DEST"
OPS_WORK_DIR="$DEST"

# The credentials are checked BEFORE the dump rather than after it: finding
# out that they are missing is worth knowing in the first second, not after
# spending ten minutes compressing something that has nowhere to go.
[ "$LOCAL_ONLY" = "1" ] || ops_require_r2

echo "$RULE"
echo "  Organza backup"
echo "  Stack : $STACK  ($COMPOSE_FILE)"
echo "  Local : $DEST"
if [ "$LOCAL_ONLY" = "1" ]; then
  echo "  Off-site : SKIPPED (--local-only)"
else
  echo "  Off-site : s3://$R2_BUCKET/$STACK/  via $R2_ENDPOINT"
fi
echo "$RULE"

# ---------------------------------------------------------------------------
#  1. The database
# ---------------------------------------------------------------------------
# --clean --if-exists so the dump can be replayed over an existing database
# without hand-dropping it first. -Fc (custom format) so pg_restore can be
# selective, and because it compresses itself — there is nothing to gain by
# gzipping the result again. -Z 9 because this is a clothing shop's orders,
# not a warehouse: the CPU time is free and the nightly upload is not. On a
# database big enough for that to stop being true, lower it to 6.
CURRENT_STAGE="dump"
echo "==> Database ($DB_NAME)"
compose exec -T db pg_dump -U "$DB_USER" -d "$DB_NAME" --clean --if-exists -Fc -Z 9 \
  > "$DEST/db.dump.part" 2>"$DEST/dump.err" ||
  fail dump "pg_dump failed: $(tr '\n' ' ' < "$DEST/dump.err" | tail -c 400)"
mv "$DEST/db.dump.part" "$DEST/db.dump"
rm -f "$DEST/dump.err"

# A dump nobody has opened is a guess. pg_restore --list walks the whole
# archive, so this catches the two ways a dump is silently rubbish: a stream
# truncated by a full disk, and a file that is not an archive at all.
compose exec -T db pg_restore --list /dev/stdin < "$DEST/db.dump" > /dev/null 2>&1 ||
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

# ---------------------------------------------------------------------------
#  2. Off the box
# ---------------------------------------------------------------------------
CURRENT_STAGE="upload"
echo "==> Uploading the dump to R2"
r2 s3 cp /work/db.dump "s3://$R2_BUCKET/$DB_PREFIX/$DUMP_NAME" --only-show-errors ||
  fail upload "could not upload the dump to s3://$R2_BUCKET/$DB_PREFIX/$DUMP_NAME"

# Ask the bucket what it actually holds, rather than believing an exit code.
# An upload that wrote zero bytes exits 0 just as happily as one that worked.
REMOTE_BYTES="$(r2 s3api head-object --bucket "$R2_BUCKET" --key "$DB_PREFIX/$DUMP_NAME" \
  --query ContentLength --output text 2>/dev/null | tr -d '\r' || true)"
[ "$REMOTE_BYTES" = "$DB_BYTES" ] ||
  fail upload "the dump in R2 is ${REMOTE_BYTES:-missing} bytes but the local one is $DB_BYTES — the upload is incomplete."
echo "    s3://$R2_BUCKET/$DB_PREFIX/$DUMP_NAME ✓ ($REMOTE_BYTES bytes, verified against the local file)"

# ---------------------------------------------------------------------------
#  3. The photographs
# ---------------------------------------------------------------------------
# Read straight out of the backend container's own mount (--volumes-from, see
# common.sh), which is the path compose sets UPLOAD_DIR to — so these are
# exactly the files the API serves, not a copy that could have drifted.
#
# `s3 sync` compares size and modification time and uploads only what differs.
# Images are written once by `sharp` and never edited afterwards, so after the
# first run this moves the day's photographs and nothing else.
#
# NO --delete, deliberately. A true mirror would faithfully reproduce an
# accidental deletion, and a product photo removed by a mis-tap is exactly
# what somebody comes to a backup for. The bucket therefore accumulates: a few
# MB a month is not a storage problem worth creating a data-loss problem to
# solve.
CURRENT_STAGE="images"
echo "==> Mirroring the uploaded images (incremental)"
r2 s3 sync /app/uploads "s3://$R2_BUCKET/$UPLOADS_PREFIX/" --only-show-errors ||
  fail images "the image sync to s3://$R2_BUCKET/$UPLOADS_PREFIX/ failed"

# Counted from the BUCKET, not from the volume: the honest question is what is
# actually stored off-site, and that is the only number worth putting into a
# record somebody reads during an emergency.
SUMMARY="$(r2 s3 ls "s3://$R2_BUCKET/$UPLOADS_PREFIX/" --recursive --summarize 2>/dev/null | tail -n 3 || true)"
IMAGE_COUNT="$(printf '%s' "$SUMMARY" | sed -n 's/.*Total Objects: *\([0-9][0-9]*\).*/\1/p' | head -n 1)"
IMAGE_BYTES="$(printf '%s' "$SUMMARY" | sed -n 's/.*Total Size: *\([0-9][0-9]*\).*/\1/p' | head -n 1)"
IMAGE_COUNT="${IMAGE_COUNT:-0}"
IMAGE_BYTES="${IMAGE_BYTES:-0}"
echo "    s3://$R2_BUCKET/$UPLOADS_PREFIX/ ✓ ($IMAGE_COUNT file(s), $IMAGE_BYTES bytes in the bucket)"

if [ "$IMAGE_COUNT" = "0" ]; then
  # Not a failure — a shop that has not uploaded a photograph yet is a real
  # state. But it is also exactly what a broken mount looks like, so it is
  # said out loud rather than discovered halfway through a restore.
  echo "    ⚠  the bucket holds no images at all. Fine if nothing has been uploaded"
  echo "       yet — otherwise check that UPLOAD_DIR still matches the mount in"
  echo "       $COMPOSE_FILE (docker compose logs backend | grep -i uploads)."
fi

# ---------------------------------------------------------------------------
#  4. Retention
# ---------------------------------------------------------------------------
CURRENT_STAGE="prune"
echo "==> Pruning old dumps (keeping $KEEP_DUMPS)"
ALL_DUMPS="$(ops_list_dumps "$DB_PREFIX")"
DUMP_TOTAL="$(printf '%s' "$ALL_DUMPS" | grep -c . || true)"

if [ "${DUMP_TOTAL:-0}" -gt "$KEEP_DUMPS" ]; then
  # `head -n -N` is "all but the last N" — the oldest keys, since the list is
  # sorted oldest first.
  printf '%s\n' "$ALL_DUMPS" | head -n "-$KEEP_DUMPS" | while IFS= read -r key; do
    [ -n "$key" ] || continue
    r2 s3 rm "s3://$R2_BUCKET/$key" --only-show-errors ||
      fail prune "could not delete the old dump $key — the bucket will keep growing."
    echo "    removed $key"
  done
fi
echo "    bucket held $DUMP_TOTAL dump(s) before this run; keeping the newest $KEEP_DUMPS"

# The VPS's own copies, trimmed for the opposite reason: none of them is the
# archive, and a year of dumps is how the disk this all runs on fills up.
find "$DEST_ROOT/$STACK" -mindepth 1 -maxdepth 1 -type d 2>/dev/null | sort | head -n "-$KEEP_LOCAL_DUMPS" |
  while IFS= read -r old; do [ -n "$old" ] && rm -rf "$old" && echo "    removed local $old"; done

# ---------------------------------------------------------------------------
#  5. Say that it worked
# ---------------------------------------------------------------------------
# Two places, because they fail differently. The file is readable with `ls`
# when nothing else is up; the database row is what /health serves and what
# `npm run backup:status` prints, and is therefore what makes a schedule that
# quietly stopped visible without anybody logging in to look.
CURRENT_STAGE="record"
ELAPSED="$(( $(date -u +%s) - START_SECONDS ))"
echo "$STAMP  stack=$STACK  db=$DB_NAME  dump=$DB_BYTES bytes  images=$IMAGE_COUNT  ${ELAPSED}s" \
  >> "$DEST_ROOT/backup.log"
printf '%s  s3://%s/%s/%s\n' "$STAMP" "$R2_BUCKET" "$DB_PREFIX" "$DUMP_NAME" \
  > "$DEST_ROOT/last-success.txt"

report_run SUCCEEDED \
  --started-at="$STARTED_AT" \
  --database-bytes="$DB_BYTES" \
  --image-count="$IMAGE_COUNT" \
  --image-bytes="$IMAGE_BYTES" \
  --destination="s3://$R2_BUCKET/$STACK"

trap - ERR
echo ""
echo "$RULE"
echo "  ✔ Backed up in ${ELAPSED}s"
echo "    database : s3://$R2_BUCKET/$DB_PREFIX/$DUMP_NAME  ($DB_BYTES bytes)"
echo "    images   : s3://$R2_BUCKET/$UPLOADS_PREFIX/  ($IMAGE_COUNT file(s))"
echo "    restore  : ./ops/restore.sh --list — and rehearse it on the sandbox first."
echo "$RULE"
