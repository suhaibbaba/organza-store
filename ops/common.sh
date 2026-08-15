#!/usr/bin/env bash
#
# Shared plumbing for ops/backup.sh and ops/restore.sh.
#
# Sourced, never executed. It exists because the two scripts have to agree
# about a handful of things, and the one place a disagreement would surface is
# a restore during an emergency:
#
#   * WHICH STACK they are working on — and that the compose file, the env
#     file and the database all belong to that same one;
#   * how the R2 endpoint is derived when only the account id is configured;
#   * what the bucket's layout is (<project>/database/… and <project>/uploads/…);
#   * how the AWS CLI is run, and with which volume attached;
#   * how a dump is proven readable before anybody trusts it.

# ---------------------------------------------------------------------------
#  Which stack — ONE choice, both files
# ---------------------------------------------------------------------------
# This used to be two independent variables, COMPOSE_FILE and ENV_FILE, each
# defaulting to the sandbox on its own. Setting only one produced a working
# command that operated on a MIXTURE of the two deployments: in practice
# `ENV_FILE=.env.production` read production's credentials and its R2 bucket
# while still driving `docker-compose.sandbox.yml`, so the nightly cron dumped
# the SANDBOX into production's folder every night while everybody believed
# the shop was protected. Nothing errored. That is only discovered during an
# emergency, which is the worst way to find out that there is no backup.
#
# So the stack is now one word, and it derives both files together. There is
# deliberately no way to set them individually any more — see ops_load_env,
# which refuses rather than letting the old habit half-work.
STACK="${STACK:-sandbox}"

# Captured HERE, before anything below assigns them, so a value that came from
# the caller's environment can still be told apart from the ones this file is
# about to derive. That is the whole point of the refusal in ops_load_env.
OPS_INHERITED_COMPOSE_FILE="${COMPOSE_FILE:-}"
OPS_INHERITED_ENV_FILE="${ENV_FILE:-}"

STACK_PRODUCTION="production"
STACK_SANDBOX="sandbox"

# A sandbox database has to say so in its own name. The same marker the
# backend's `import:prod` guard uses (backend/src/constants/productionImport.ts)
# — a value somebody types into a compose file can be wrong, while the database
# name travels with the database itself.
SANDBOX_DATABASE_MARKER="sandbox"

# Pinned rather than `latest`: an unattended 02:30 run is the worst possible
# moment to discover that a new CLI release changed a default.
AWS_CLI_IMAGE="${AWS_CLI_IMAGE:-amazon/aws-cli:2.36.24}"

# shellcheck disable=SC2034  # used by the scripts that source this file
RULE="══════════════════════════════════════════════════════════════════"

die() { echo "  ✖ $*" >&2; exit 1; }

ops_stack_compose_file() {
  case "$1" in
    "$STACK_PRODUCTION") printf 'docker-compose.prod.yml' ;;
    "$STACK_SANDBOX")    printf 'docker-compose.sandbox.yml' ;;
    *) die "unknown stack \"$1\" — it is $STACK_PRODUCTION or $STACK_SANDBOX." ;;
  esac
}

ops_stack_env_file() {
  case "$1" in
    "$STACK_PRODUCTION") printf '.env.production' ;;
    "$STACK_SANDBOX")    printf '.env.sandbox' ;;
    *) die "unknown stack \"$1\" — it is $STACK_PRODUCTION or $STACK_SANDBOX." ;;
  esac
}

# The compose PROJECT name — the prefix Docker puts on the volumes, and the
# folder each stack gets in the bucket. Read from that stack's compose file, so
# it can be asked about a stack that is not the one running here (which is what
# lets a restore read production's backups while pointed at the sandbox).
ops_stack_project() {
  local file name
  file="$(ops_stack_compose_file "$1")"
  [ -f "$file" ] || die "no $file here. cd to the directory that holds the compose files."
  name="$(sed -n 's/^name:[[:space:]]*\(.*\)$/\1/p' "$file" | head -n 1)"
  printf '%s' "${name:-organza}"
}

compose() { docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" "$@"; }

# ---------------------------------------------------------------------------
#  Resolve the stack, load its settings, and refuse a mixture
# ---------------------------------------------------------------------------
# Sets COMPOSE_FILE, ENV_FILE, STACK_PROJECT, DB_USER, DB_NAME and the R2_*
# values, all from the one `STACK` word.
ops_load_env() {
  # The old interface, caught loudly rather than half-honoured. Anybody still
  # carrying `ENV_FILE=.env.production` in a cron entry gets an error tonight
  # instead of a year of sandbox backups filed under production's name.
  if [ -n "$OPS_INHERITED_COMPOSE_FILE$OPS_INHERITED_ENV_FILE" ]; then
    cat >&2 <<EOF

$RULE
  ⛔  REFUSING TO RUN — COMPOSE_FILE / ENV_FILE are no longer settable
$RULE
  Seen : ${OPS_INHERITED_COMPOSE_FILE:-(unset)} / ${OPS_INHERITED_ENV_FILE:-(unset)}

  These used to be two independent variables, and setting only one gave
  you a working command pointed at a MIXTURE of the two deployments —
  production's credentials driving the sandbox's containers, with
  nothing to say so. A nightly cron entry like that backs up the wrong
  stack for as long as nobody looks.

  Name the stack instead, once, and both files follow:

      STACK=$STACK_PRODUCTION  ./ops/backup.sh
      STACK=$STACK_SANDBOX     ./ops/backup.sh

$RULE

EOF
    exit 1
  fi

  case "$STACK" in
    "$STACK_PRODUCTION"|"$STACK_SANDBOX") ;;
    *) die "STACK must be $STACK_PRODUCTION or $STACK_SANDBOX — got \"$STACK\"." ;;
  esac

  COMPOSE_FILE="$(ops_stack_compose_file "$STACK")"
  ENV_FILE="$(ops_stack_env_file "$STACK")"
  STACK_PROJECT="$(ops_stack_project "$STACK")"

  [ -f "$COMPOSE_FILE" ] || die "no $COMPOSE_FILE here. cd to the directory that holds it."
  [ -f "$ENV_FILE" ]     || die "no $ENV_FILE here — STACK=$STACK expects that file next to $COMPOSE_FILE."

  # Sourced through a path that always contains a directory, so a bare
  # filename is never looked up on PATH.
  local env_path="$ENV_FILE"
  case "$env_path" in /*) ;; *) env_path="./$env_path" ;; esac
  set -a
  # shellcheck disable=SC1090  # the path is the chosen stack's env file, by design
  . "$env_path"
  set +a
  : "${DB_USER:?not set in $ENV_FILE}"
  : "${DB_NAME:?not set in $ENV_FILE}"

  ops_assert_stack_matches_database
}

# The second, independent check. STACK picks the files; this asks whether the
# database those files actually point at belongs to the stack that was named.
# A sandbox database says "sandbox" in its own name (rule 11's marker); the
# shop's does not.
ops_assert_stack_matches_database() {
  case "$STACK" in
    "$STACK_SANDBOX")
      case "$DB_NAME" in
        *"$SANDBOX_DATABASE_MARKER"*) ;;
        *) die "STACK=$STACK_SANDBOX but $ENV_FILE names database \"$DB_NAME\", which does not contain \"$SANDBOX_DATABASE_MARKER\". Refusing: this looks like the live shop's database under the sandbox's name." ;;
      esac
      ;;
    "$STACK_PRODUCTION")
      case "$DB_NAME" in
        *"$SANDBOX_DATABASE_MARKER"*) die "STACK=$STACK_PRODUCTION but $ENV_FILE names database \"$DB_NAME\", which contains \"$SANDBOX_DATABASE_MARKER\". Refusing: this would file a SANDBOX backup as the shop's." ;;
        *) ;;
      esac
      ;;
  esac
}

# The third check, and the only one that asks the running deployment rather
# than a file. Warns rather than aborts when it cannot be read at all: an
# observed disagreement is a mistake, an unanswerable question is just a
# container that is not up.
ops_assert_stack_matches_app_env() {
  local observed
  observed="$(ops_probe_app_env)"
  [ -n "$observed" ] || {
    echo "  ⚠  could not read APP_ENV from the running backend container — stack not cross-checked."
    return 0
  }
  [ "$observed" = "$STACK" ] ||
    die "STACK=$STACK but the running backend reports APP_ENV=$observed. Refusing: the files and the running stack disagree about which deployment this is."
}

# ---------------------------------------------------------------------------
#  Which deployment the RUNNING container thinks it is
# ---------------------------------------------------------------------------
# Asked of the container rather than of a file, because that is where the
# answer actually lives: docker-compose.prod.yml sets APP_ENV in
# `environment:`, which overrides `env_file:` — so reading .env.production
# would report "unset" on the live shop.
#
# ops_probe_app_env returns EMPTY when it cannot tell. ops_app_env turns that
# into "production", which is the right way round for a destructive guard
# (backend/src/lib/appEnv.ts does the same): a missing value must never be the
# reason a refusal stands down.
ops_probe_app_env() {
  compose exec -T backend printenv APP_ENV 2>/dev/null | tr -d '\r\n' || true
}

ops_app_env() {
  local value
  value="$(ops_probe_app_env)"
  printf '%s' "${value:-$STACK_PRODUCTION}"
}

# The header both scripts print, and the line a cron log gets read for. Every
# value that decides WHAT was touched, in one block, so "which environment did
# last night actually back up?" is never a matter of inference.
ops_print_target() {
  echo "  Stack    : $STACK  (project $STACK_PROJECT)"
  echo "  Compose  : $COMPOSE_FILE"
  echo "  Env file : $ENV_FILE"
  echo "  Database : $DB_NAME"
}

# ---------------------------------------------------------------------------
#  The bucket's layout, in one place so both scripts spell it the same way
# ---------------------------------------------------------------------------
ops_db_prefix()      { printf '%s/database' "$1"; }
ops_uploads_prefix() { printf '%s/uploads' "$1"; }

# ---------------------------------------------------------------------------
#  Cloudflare R2
# ---------------------------------------------------------------------------
ops_require_r2() {
  : "${R2_BUCKET:?not set in $ENV_FILE — see backend/.env.example, 'Off-site backups (Cloudflare R2)'}"
  : "${R2_ACCESS_KEY_ID:?not set in $ENV_FILE}"
  : "${R2_SECRET_ACCESS_KEY:?not set in $ENV_FILE}"
  # The endpoint is derivable from the account id, so only one of the two has
  # to be filled in — but both are documented, because a bucket reached
  # through a custom domain needs the endpoint spelled out.
  if [ -z "${R2_ENDPOINT:-}" ]; then
    : "${R2_ACCOUNT_ID:?set either R2_ENDPOINT or R2_ACCOUNT_ID in $ENV_FILE}"
    R2_ENDPOINT="https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com"
  fi
}

# The uploads volume is attached by --volumes-from rather than by name: the
# backend container already has it mounted at /app/uploads, so this inherits
# the mount without either script having to know what Docker called the volume
# (the compose project name plus the volume key — something a rename would
# silently redirect to an empty one).
#
# $OPS_WORK_DIR, when set, is mounted at /work, which is how a dump gets in
# and out of the container.
OPS_BACKEND_CONTAINER=""
ops_backend_container() {
  if [ -z "$OPS_BACKEND_CONTAINER" ]; then
    OPS_BACKEND_CONTAINER="$(compose ps -q backend)"
    [ -n "$OPS_BACKEND_CONTAINER" ] ||
      die "the backend container is not running — start the stack first (docker compose up -d)."
  fi
  printf '%s' "$OPS_BACKEND_CONTAINER"
}

# The two checksum settings are for R2 specifically. AWS CLI v2.23 began
# sending its own integrity headers by default, which S3-compatible services
# that are not S3 reject; `when_required` is the pre-2.23 behaviour and is
# ignored by older clients, so it is safe in both directions.
r2() {
  local work_mount=()
  [ -n "${OPS_WORK_DIR:-}" ] && work_mount=(-v "$(cd "$OPS_WORK_DIR" && pwd)":/work)

  docker run --rm \
    --volumes-from "$(ops_backend_container)" \
    "${work_mount[@]}" \
    -e AWS_ACCESS_KEY_ID="$R2_ACCESS_KEY_ID" \
    -e AWS_SECRET_ACCESS_KEY="$R2_SECRET_ACCESS_KEY" \
    -e AWS_REQUEST_CHECKSUM_CALCULATION=when_required \
    -e AWS_RESPONSE_CHECKSUM_VALIDATION=when_required \
    "$AWS_CLI_IMAGE" \
    --endpoint-url "$R2_ENDPOINT" --region auto "$@"
}

# Every dump in the bucket for a project, oldest first.
#
# The keys are timestamped and share a prefix, so sorting them lexically sorts
# them by age — no dates have to be parsed, and nothing depends on an object's
# mtime, which a copy or a lifecycle rule could rewrite.
ops_list_dumps() {
  local prefix="$1"
  r2 s3api list-objects-v2 --bucket "$R2_BUCKET" --prefix "$prefix/" \
    --query 'sort_by(Contents,&Key)[].Key' --output text 2>/dev/null |
    tr '\t' '\n' | grep -v '^None$' | grep . || true
}

# ---------------------------------------------------------------------------
#  Proving a dump is readable
# ---------------------------------------------------------------------------
# Two things have to be true for this to be worth anything, and both were got
# wrong at least once. ops/selftest.sh pins them down.
#
# 1. IT HAS TO READ A REAL FILE.
#    A custom-format (-Fc) archive is read by seeking, and `docker compose
#    exec -T` hands the container a PIPE. So the obvious spelling,
#
#        compose exec -T db pg_restore --list /dev/stdin < dump      # WRONG
#
#    fails on every dump ever taken, valid ones included, with "did not find
#    magic string in file header". It reads as corruption and it is not — it is
#    the check being impossible, and because it fails closed, the backup then
#    aborts nightly and uploads nothing. (A full restore IS fine from a pipe,
#    which is why restoring worked while verifying could not.)
#
#    So the dump is copied into the db container and read there, as a file.
#    Inside that container on purpose: it is the same image that produced the
#    dump, so the pg_restore reading it is exactly the version of the pg_dump
#    that wrote it, with no host tooling to install or keep in step.
#
# 2. IT HAS TO READ THE DATA, NOT JUST THE HEADER.
#    `pg_restore --list` only walks the table of contents, which sits at the
#    FRONT of the archive — so a dump truncated to half its length lists
#    perfectly and passes. Truncation is the failure mode that actually
#    happens (a full disk, a killed process), so a check that misses it is
#    ceremony.
#
#    `--file=/dev/null` converts the whole archive to SQL and throws it away,
#    which forces every compressed data block to be read and decompressed. It
#    touches no database. That costs CPU proportional to the dump — far less
#    than the pg_dump that produced it — and it is the difference between
#    knowing a dump is restorable and hoping so.
#
# The copy is removed whether the check passes or fails; it lives in the
# container's own /tmp, so it needs room for one dump for a few seconds and
# anything a kill leaves behind dies with the container.
ops_verify_dump() {
  local local_file="$1"
  local remote rc=0
  remote="/tmp/organza-verify-$$-$(basename "$local_file")"

  compose cp "$local_file" "db:$remote" >/dev/null 2>&1 || {
    echo "could not copy the dump into the db container to verify it" >&2
    return 1
  }
  compose exec -T db pg_restore --file=/dev/null "$remote" >/dev/null 2>&1 || rc=1
  compose exec -T db rm -f "$remote" >/dev/null 2>&1 || true

  return $rc
}
