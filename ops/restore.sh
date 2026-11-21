#!/usr/bin/env bash
# DESTRUCTIVE: put a backup back (--list, --from-r2 latest|<stamp>, <dir>, --from-stack); needs the typed phrases below.
set -euo pipefail

OPS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=ops/common.sh
. "$OPS_DIR/common.sh"

# The same phrases as the backend's destructive commands (backend/src/constants/dangerousCommands.ts).
CONFIRM_PHRASE="I-KNOW-THIS-OVERWRITES-THE-DATABASE"
PRODUCTION_PHRASE="I-KNOW-THIS-IS-PRODUCTION"

WORK_ROOT="${RESTORE_WORK_DIR:-./backups/.restore}"

SRC=""            # a local backup directory
FROM_R2=""        # "latest" or a timestamp
FROM_STACK=""     # whose backups to read; defaults to the stack being restored
LIST_ONLY=0
SKIP_IMAGES=0

while [ $# -gt 0 ]; do
  case "$1" in
    --list)           LIST_ONLY=1; shift ;;
    --from-r2)        FROM_R2="${2:-latest}"; shift 2 ;;
    --from-r2=*)      FROM_R2="${1#*=}"; shift ;;
    --stack)          STACK="${2:?--stack needs production or sandbox}"; shift 2 ;;
    --stack=*)        STACK="${1#*=}"; shift ;;
    --from-stack)     FROM_STACK="${2:?--from-stack needs production or sandbox}"; shift 2 ;;
    --from-stack=*)   FROM_STACK="${1#*=}"; shift ;;
    --skip-images)    SKIP_IMAGES=1; shift ;;
    -*)               die "unknown flag: $1 (see the header of this script)" ;;
    *)                SRC="$1"; shift ;;
  esac
done

# STACK is what is written to; FROM_STACK only whose backups are read (defaults to the same).
ops_load_env
SOURCE_STACK="${FROM_STACK:-$STACK}"
SOURCE_PROJECT="$(ops_stack_project "$SOURCE_STACK")"
DB_PREFIX="$(ops_db_prefix "$SOURCE_PROJECT")"
UPLOADS_PREFIX="$(ops_uploads_prefix "$SOURCE_PROJECT")"

if [ "$LIST_ONLY" = "1" ]; then
  ops_require_r2
  echo "$RULE"
  echo "  Dumps in s3://$R2_BUCKET/$DB_PREFIX/  (stack: $SOURCE_STACK, project $SOURCE_PROJECT)"
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

# Restoring production onto the sandbox copies everything personal; import:prod is the catalogue-only route (rule 11).
if [ "$SOURCE_STACK" != "$STACK" ]; then
  cat >&2 <<EOF

  ⚠  CROSS-STACK RESTORE
     from : $SOURCE_STACK's backups (s3://$R2_BUCKET/$DB_PREFIX/)
     onto : $STACK  (database "$DB_NAME", via $COMPOSE_FILE)

     A dump carries everything, personal data included — customers' phone
     numbers, staff addresses and id numbers, every order and the whole
     audit trail. Putting the live shop's dump on the sandbox copies all of
     that onto the less protected of the two deployments.

     If what you actually want is the catalogue — products, categories,
     variants and photographs, and nothing about a person — that is
     \`npm run import:prod\` (backend/README.md), not this.

EOF
fi

# APP_ENV comes from the running container: compose's environment: overrides the env file.
APP_ENV_VALUE="$(ops_app_env)"
IS_PRODUCTION=0
[ "$APP_ENV_VALUE" = "production" ] && IS_PRODUCTION=1

if [ "${STORE_RESTORE_CONFIRM:-}" != "$CONFIRM_PHRASE" ]; then
  cat >&2 <<EOF

$RULE
  ⛔  REFUSING TO RESTORE
$RULE
  From     : ${FROM_R2:+s3://$R2_BUCKET/$DB_PREFIX/ ($FROM_R2)}${SRC}
  Onto     : STACK=$STACK — database "$DB_NAME"
             via $COMPOSE_FILE + $ENV_FILE
             and the uploads volume behind /app/uploads
  APP_ENV  : $APP_ENV_VALUE

  This REPLACES the database that is there now. Every order, every
  product and every account entered since that backup was taken is
  gone, and there is no undo.

  If that is what you mean, say so in full:

      STORE_RESTORE_CONFIRM=$CONFIRM_PHRASE \\
        STACK=$STACK ./ops/restore.sh ${FROM_STACK:+--from-stack $FROM_STACK }${FROM_R2:+--from-r2 $FROM_R2}${SRC}

  Take a dump of what is there NOW first — even if you are sure.
  Especially if you are sure:

      ./ops/backup.sh --local-only
$RULE

EOF
  exit 1
fi

# Restoring the live shop is allowed, but only with a second typed phrase, like db:reset.
if [ "$IS_PRODUCTION" = "1" ] && [ "${STORE_ALLOW_PRODUCTION:-}" != "$PRODUCTION_PHRASE" ]; then
  cat >&2 <<EOF

$RULE
  ⛔  REFUSING TO RESTORE — that is the LIVE SHOP
$RULE
  Stack    : $STACK
  Database : $DB_NAME  ($COMPOSE_FILE + $ENV_FILE)
  APP_ENV  : $APP_ENV_VALUE

  Restoring here overwrites the real shop's real orders with whatever
  the backup held. Anything sold since it was taken disappears.

  If you genuinely mean it, say THAT in full as well:

      STORE_ALLOW_PRODUCTION=$PRODUCTION_PHRASE \\
      STORE_RESTORE_CONFIRM=$CONFIRM_PHRASE \\
        STACK=$STACK ./ops/restore.sh ${FROM_STACK:+--from-stack $FROM_STACK }${FROM_R2:+--from-r2 $FROM_R2}${SRC}

  If you are rehearsing rather than recovering, point this at the
  sandbox instead:

      STACK=sandbox --from-stack production \\
        ./ops/restore.sh ${FROM_R2:+--from-r2 $FROM_R2}${SRC}
$RULE

EOF
  exit 1
fi

if [ -n "$FROM_R2" ]; then
  ops_require_r2
  mkdir -p "$WORK_ROOT"
  SRC="$WORK_ROOT/$SOURCE_PROJECT"
  rm -rf "$SRC"; mkdir -p "$SRC"
  OPS_WORK_DIR="$SRC"

  if [ "$FROM_R2" = "latest" ]; then
    KEY="$(ops_list_dumps "$DB_PREFIX" | tail -n 1)"
    [ -n "$KEY" ] || die "there are no dumps in s3://$R2_BUCKET/$DB_PREFIX/ — nothing to restore."
  else
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

# Verify the dump BEFORE the live database is touched: --clean drops every table first.
echo "$RULE"
echo "  Store Management restore"
echo "$RULE"
ops_print_target
if [ -n "$FROM_R2" ]; then
  echo "  From     : s3://$R2_BUCKET/$KEY"
else
  echo "  From     : $SRC  (local copy)"
fi
echo "$RULE"

# The running deployment must agree with the files too.
ops_assert_stack_matches_app_env

echo "==> Checking the dump is readable before touching anything"
# Verified as a file in the db container: the archive must be seekable, which compose exec -T's pipe is not.
ops_verify_dump "$SRC/db.dump" ||
  die "that dump is not readable by pg_restore. The database has NOT been touched. Try another one (--list)."
echo "    $(du -h "$SRC/db.dump" | cut -f1), readable ✓"

echo "==> Restoring database $DB_NAME"
# -1 makes the restore one transaction, so a failure leaves the database as it was; --no-owner because roles may not exist here.
compose exec -T db pg_restore -U "$DB_USER" -d "$DB_NAME" --clean --if-exists --no-owner -1 \
  < "$SRC/db.dump" ||
  die "pg_restore failed. Because of -1 the database is unchanged — it was rolled back."

# Copied over what is there, never replacing the directory: photos uploaded after the backup are kept.
if [ "$SKIP_IMAGES" = "1" ]; then
  echo "==> Skipping the images (--skip-images)"
elif [ -n "$FROM_R2" ]; then
  echo "==> Restoring the images from R2 into /app/uploads"
  r2 s3 sync "s3://$R2_BUCKET/$UPLOADS_PREFIX/" /app/uploads --only-show-errors ||
    die "the database is restored, but the image sync failed. Re-run with --from-r2 $FROM_R2 to finish the job."
elif [ -f "$SRC/uploads.tar.gz" ]; then
  # Older backups kept photos in a tar rooted at uploads/, so it unpacks into /app.
  echo "==> Restoring the images from this backup's uploads.tar.gz"
  gunzip -c "$SRC/uploads.tar.gz" | compose cp -a - backend:/app
else
  echo "==> No images in this backup — skipping (the database is restored)"
fi

echo "==> Restarting the API so it re-reads what it has"
compose restart backend >/dev/null

echo ""
echo "$RULE"
echo "  ✔ Restored STACK=$STACK ($DB_NAME, via $COMPOSE_FILE + $ENV_FILE)"
if [ -n "$FROM_R2" ]; then
  echo "    from s3://$R2_BUCKET/$KEY"
else
  echo "    from $SRC"
fi
echo ""
echo "  The check that matters is not that this exited 0. Open the admin,"
echo "  find a product with a photograph, and SEE the photograph. Then open"
echo "  the orders list and find the last order you know was taken."
echo "$RULE"
