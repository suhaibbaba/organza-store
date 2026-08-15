#!/usr/bin/env bash
#
# Organza — put a backup back.
#
#   ./ops/restore.sh --list                  # what is in the bucket
#   ./ops/restore.sh --from-r2 latest        # the most recent nightly dump
#   ./ops/restore.sh --from-r2 20260815T023000Z
#   ./ops/restore.sh ./backups/organza-prod/20260815T023000Z   # a local copy
#
# By default it reads the backups of the stack it is pointed at, so putting
# the shop back the way it was needs no flag. --source-stack reads somebody
# else's — which is how the live shop's dump is rehearsed on the sandbox:
#
#   COMPOSE_FILE=docker-compose.sandbox.yml ENV_FILE=.env.sandbox \\
#     ./ops/restore.sh --source-stack organza-prod --from-r2 latest
#
# DESTRUCTIVE. It replaces the database in the running stack and puts the
# archived photographs back into the uploads volume. Like `db:reset`, it
# refuses to do that on a word — the confirmation has to be typed out in full,
# and pointed at the LIVE SHOP it wants a second one on top:
#
#   ORGANZA_RESTORE_CONFIRM=I-KNOW-THIS-OVERWRITES-THE-DATABASE \
#     ./ops/restore.sh --from-r2 latest
#
#   ORGANZA_ALLOW_PRODUCTION=I-KNOW-THIS-IS-PRODUCTION \
#   ORGANZA_RESTORE_CONFIRM=I-KNOW-THIS-OVERWRITES-THE-DATABASE \
#     COMPOSE_FILE=docker-compose.prod.yml ENV_FILE=.env.production \
#     ./ops/restore.sh --from-r2 latest
#
# A backup that has never been restored is a hope, not a backup. Rehearse this
# on the sandbox — that is what the sandbox is for, and the rehearsal needs no
# second phrase because the sandbox is not the shop.
set -euo pipefail

OPS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=ops/common.sh
. "$OPS_DIR/common.sh"

# The same two phrases the backend's own destructive commands use, spelled the
# same way — see backend/src/constants/dangerousCommands.ts. Somebody who has
# typed one of these before should not have to learn a second dialect at the
# worst possible moment.
CONFIRM_PHRASE="I-KNOW-THIS-OVERWRITES-THE-DATABASE"
PRODUCTION_PHRASE="I-KNOW-THIS-IS-PRODUCTION"

WORK_ROOT="${RESTORE_WORK_DIR:-./backups/.restore}"

# ---------------------------------------------------------------------------
#  What are we restoring, and from where
# ---------------------------------------------------------------------------
SRC=""            # a local backup directory
FROM_R2=""        # "latest" or a timestamp
SOURCE_STACK=""   # whose backups to read; defaults to the target's own
LIST_ONLY=0
SKIP_IMAGES=0

while [ $# -gt 0 ]; do
  case "$1" in
    --list)             LIST_ONLY=1; shift ;;
    --from-r2)          FROM_R2="${2:-latest}"; shift 2 ;;
    --from-r2=*)        FROM_R2="${1#*=}"; shift ;;
    --source-stack)     SOURCE_STACK="${2:?--source-stack needs a name}"; shift 2 ;;
    --source-stack=*)   SOURCE_STACK="${1#*=}"; shift ;;
    --skip-images)      SKIP_IMAGES=1; shift ;;
    -*)                 die "unknown flag: $1 (see the header of this script)" ;;
    *)                  SRC="$1"; shift ;;
  esac
done

ops_load_env
# Two stacks, not one. TARGET_STACK is what is being written to — it comes
# from the compose file and cannot be chosen. SOURCE_STACK is whose backups
# are read, and defaults to the same thing, so the ordinary "put the shop back
# the way it was" needs no flag at all.
TARGET_STACK="$(ops_resolve_stack)"
STACK="${SOURCE_STACK:-$TARGET_STACK}"
DB_PREFIX="$(ops_db_prefix "$STACK")"
UPLOADS_PREFIX="$(ops_uploads_prefix "$STACK")"

# ---------------------------------------------------------------------------
#  --list: what is actually there
# ---------------------------------------------------------------------------
# Worth its own mode. The first thing anybody wants during an incident is not
# a restore, it is the answer to "what have we got, and how old is it".
if [ "$LIST_ONLY" = "1" ]; then
  ops_require_r2
  echo "$RULE"
  echo "  Dumps in s3://$R2_BUCKET/$DB_PREFIX/  (stack: $STACK)"
  echo "$RULE"
  DUMPS="$(ops_list_dumps "$DB_PREFIX")"
  if [ -z "$DUMPS" ]; then
    echo "  (nothing — this stack has never been backed up to this bucket)"
  else
    printf '%s\n' "$DUMPS" | sed 's|^|  |'
    echo ""
    echo "  newest: $(printf '%s\n' "$DUMPS" | tail -n 1)"
  fi
  echo "$RULE"
  exit 0
fi

[ -n "$SRC$FROM_R2" ] ||
  die "nothing to restore from. Use --from-r2 latest, --from-r2 <timestamp>, or give a local backup directory. --list shows what exists."
[ -z "$SRC" ] || [ -z "$FROM_R2" ] ||
  die "pick one source: either a local directory or --from-r2, not both."

# ---------------------------------------------------------------------------
#  Rehearsing with somebody else's data
# ---------------------------------------------------------------------------
# Restoring the live shop's backup onto the sandbox is the only honest
# rehearsal there is, so it is allowed — but it is not the same act as putting
# the shop back, and saying so is the difference between an informed choice
# and a surprise. A dump is EVERYTHING: orders, customers' phone numbers,
# staff addresses and id numbers, the whole audit trail. `npm run import:prod`
# exists precisely because the usual reason to want production data on the
# sandbox is the catalogue, and it carries nothing personal (CLAUDE.md
# rule 11).
if [ -n "$SOURCE_STACK" ] && [ "$SOURCE_STACK" != "$TARGET_STACK" ]; then
  cat >&2 <<EOF

  ⚠  CROSS-STACK RESTORE
     from : $SOURCE_STACK's backups
     onto : $TARGET_STACK  (database "$DB_NAME")

     A dump carries everything, personal data included — customers' phone
     numbers, staff addresses and id numbers, every order and the whole
     audit trail. Putting the live shop's dump on the sandbox copies all of
     that onto the less protected of the two deployments.

     If what you actually want is the catalogue — products, categories,
     variants and photographs, and nothing about a person — that is
     \`npm run import:prod\` (backend/README.md), not this.

EOF
fi

# ---------------------------------------------------------------------------
#  The refusals
# ---------------------------------------------------------------------------
# Read from the RUNNING container, not from a file — docker-compose.prod.yml
# sets APP_ENV in `environment:`, which overrides `env_file:`, so asking
# .env.production would answer "unset" on the live shop (common.sh).
APP_ENV_VALUE="$(ops_app_env)"
IS_PRODUCTION=0
[ "$APP_ENV_VALUE" = "production" ] && IS_PRODUCTION=1

if [ "${ORGANZA_RESTORE_CONFIRM:-}" != "$CONFIRM_PHRASE" ]; then
  cat >&2 <<EOF

$RULE
  ⛔  REFUSING TO RESTORE
$RULE
  From     : ${FROM_R2:+s3://$R2_BUCKET/$DB_PREFIX/ ($FROM_R2)}${SRC}
  Onto     : database "$DB_NAME" in $COMPOSE_FILE
             and the uploads volume behind /app/uploads
  APP_ENV  : $APP_ENV_VALUE

  This REPLACES the database that is there now. Every order, every
  product and every account entered since that backup was taken is
  gone, and there is no undo.

  If that is what you mean, say so in full:

      ORGANZA_RESTORE_CONFIRM=$CONFIRM_PHRASE \\
        ./ops/restore.sh ${FROM_R2:+--from-r2 $FROM_R2}${SRC}

  Take a dump of what is there NOW first — even if you are sure.
  Especially if you are sure:

      ./ops/backup.sh --local-only
$RULE

EOF
  exit 1
fi

# The second phrase, and only on the live shop. Same shape as `db:reset`
# (backend/src/lib/dangerousCommands.ts): the shop may genuinely need to
# restore production — that is what a backup is FOR — so this is a second
# deliberate sentence rather than a refusal that would only get worked around
# with pg_restore by hand, which is worse.
if [ "$IS_PRODUCTION" = "1" ] && [ "${ORGANZA_ALLOW_PRODUCTION:-}" != "$PRODUCTION_PHRASE" ]; then
  cat >&2 <<EOF

$RULE
  ⛔  REFUSING TO RESTORE — that is the LIVE SHOP
$RULE
  Database : $DB_NAME  ($COMPOSE_FILE)
  APP_ENV  : $APP_ENV_VALUE

  Restoring here overwrites the real shop's real orders with whatever
  the backup held. Anything sold since it was taken disappears.

  If you genuinely mean it, say THAT in full as well:

      ORGANZA_ALLOW_PRODUCTION=$PRODUCTION_PHRASE \\
      ORGANZA_RESTORE_CONFIRM=$CONFIRM_PHRASE \\
        ./ops/restore.sh ${FROM_R2:+--from-r2 $FROM_R2}${SRC}

  If you are rehearsing rather than recovering, point this at the
  sandbox instead:

      COMPOSE_FILE=docker-compose.sandbox.yml ENV_FILE=.env.sandbox \\
        ./ops/restore.sh ${FROM_R2:+--from-r2 $FROM_R2}${SRC}
$RULE

EOF
  exit 1
fi

# ---------------------------------------------------------------------------
#  Fetch, if it is not already here
# ---------------------------------------------------------------------------
if [ -n "$FROM_R2" ]; then
  ops_require_r2
  mkdir -p "$WORK_ROOT"
  SRC="$WORK_ROOT/$STACK"
  rm -rf "$SRC"; mkdir -p "$SRC"
  OPS_WORK_DIR="$SRC"

  if [ "$FROM_R2" = "latest" ]; then
    KEY="$(ops_list_dumps "$DB_PREFIX" | tail -n 1)"
    [ -n "$KEY" ] || die "there are no dumps in s3://$R2_BUCKET/$DB_PREFIX/ — nothing to restore."
  else
    # A timestamp rather than a whole key, because a timestamp is what the
    # log, the bucket listing and the backup's own output all print.
    KEY="$(ops_list_dumps "$DB_PREFIX" | grep -- "$FROM_R2" | tail -n 1 || true)"
    [ -n "$KEY" ] ||
      die "no dump matching \"$FROM_R2\" in s3://$R2_BUCKET/$DB_PREFIX/. Run ./ops/restore.sh --list."
  fi

  echo "==> Downloading s3://$R2_BUCKET/$KEY"
  r2 s3 cp "s3://$R2_BUCKET/$KEY" /work/db.dump --only-show-errors ||
    die "could not download the dump. Check the R2 credentials in $ENV_FILE."
else
  OPS_WORK_DIR="$SRC"
  [ -d "$SRC" ]         || die "no such backup directory: $SRC"
  [ -f "$SRC/db.dump" ] || die "no db.dump in $SRC"
fi

# ---------------------------------------------------------------------------
#  Look before overwriting
# ---------------------------------------------------------------------------
# The dump is opened and read through BEFORE the live database is touched. A
# truncated download or a half-written object is a thing that happens, and
# discovering it after `--clean` has dropped every table is discovering it in
# the worst order possible.
echo "==> Checking the dump is readable before touching anything"
compose exec -T db pg_restore --list /dev/stdin < "$SRC/db.dump" > /dev/null 2>&1 ||
  die "that dump is not readable by pg_restore. The database has NOT been touched. Try another one (--list)."
echo "    $(du -h "$SRC/db.dump" | cut -f1), readable ✓"

# ---------------------------------------------------------------------------
#  The database
# ---------------------------------------------------------------------------
echo "==> Restoring database $DB_NAME"
# --clean --if-exists is baked into the dump; -1 wraps the whole thing in one
# transaction, so a restore that fails halfway leaves the database as it was
# rather than half replaced. --no-owner because the roles inside a dump need
# not exist on the machine it is being put back onto.
compose exec -T db pg_restore -U "$DB_USER" -d "$DB_NAME" --clean --if-exists --no-owner -1 \
  < "$SRC/db.dump" ||
  die "pg_restore failed. Because of -1 the database is unchanged — it was rolled back."

# ---------------------------------------------------------------------------
#  The photographs
# ---------------------------------------------------------------------------
# Copied OVER what is there rather than replacing the directory, in every
# path below. A photo uploaded after the backup was taken is somebody's work,
# and nothing here is entitled to delete it; files of the same name are
# overwritten by the archived copy, which is what "restore" means.
if [ "$SKIP_IMAGES" = "1" ]; then
  echo "==> Skipping the images (--skip-images)"
elif [ -n "$FROM_R2" ]; then
  echo "==> Restoring the images from R2 into /app/uploads"
  # Straight into the backend container's own mount, so they land on the
  # volume at exactly the path UPLOAD_DIR points at.
  r2 s3 sync "s3://$R2_BUCKET/$UPLOADS_PREFIX/" /app/uploads --only-show-errors ||
    die "the database is restored, but the image sync failed. Re-run with --from-r2 $FROM_R2 to finish the job."
elif [ -f "$SRC/uploads.tar.gz" ]; then
  # Backups taken before the images moved to R2 kept them in a tar beside the
  # dump, whose root entry is `uploads/` — so it unpacks into /app and the
  # files land back at /app/uploads. Still read here so an old backup is not
  # a dead end.
  echo "==> Restoring the images from this backup's uploads.tar.gz"
  gunzip -c "$SRC/uploads.tar.gz" | compose cp -a - backend:/app
else
  echo "==> No images in this backup — skipping (the database is restored)"
fi

echo "==> Restarting the API so it re-reads what it has"
compose restart backend >/dev/null

echo ""
echo "$RULE"
echo "  ✔ Restored onto $DB_NAME from ${FROM_R2:+s3://$R2_BUCKET/$KEY}${FROM_R2:+ }${SRC}"
echo ""
echo "  The check that matters is not that this exited 0. Open the admin,"
echo "  find a product with a photograph, and SEE the photograph. Then open"
echo "  the orders list and find the last order you know was taken."
echo "$RULE"
