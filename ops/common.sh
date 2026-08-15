#!/usr/bin/env bash
#
# Shared plumbing for ops/backup.sh and ops/restore.sh.
#
# Sourced, never executed. It exists because the two scripts have to agree
# about four things, and the one place a disagreement would surface is a
# restore during an emergency:
#
#   * which compose file and env file the stack runs on;
#   * how the R2 endpoint is derived when only the account id is configured;
#   * what the bucket's layout is (<stack>/database/… and <stack>/uploads/…);
#   * how the AWS CLI is run, and with which volume attached.
#
# A backup writing to one endpoint and a restore reading from another is not a
# bug anybody finds on a normal Tuesday.

# ---------------------------------------------------------------------------
#  Where the stack is
# ---------------------------------------------------------------------------
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.sandbox.yml}"
ENV_FILE="${ENV_FILE:-.env.sandbox}"

# Pinned rather than `latest`: an unattended 02:30 run is the worst possible
# moment to discover that a new CLI release changed a default.
AWS_CLI_IMAGE="${AWS_CLI_IMAGE:-amazon/aws-cli:2.36.24}"

# shellcheck disable=SC2034  # used by the scripts that source this file
RULE="══════════════════════════════════════════════════════════════════"

compose() { docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" "$@"; }

die() { echo "  ✖ $*" >&2; exit 1; }

# ---------------------------------------------------------------------------
#  The stack's own settings
# ---------------------------------------------------------------------------
# The database name and user come from the same file the stack runs on, so
# neither script can quietly work on the wrong database. Sourced through a
# path that always contains a directory, so a bare filename is never looked up
# on PATH.
ops_load_env() {
  [ -f "$COMPOSE_FILE" ] || die "no $COMPOSE_FILE here. cd to the directory that holds it, or set COMPOSE_FILE."
  [ -f "$ENV_FILE" ]     || die "no $ENV_FILE here. Set ENV_FILE if it lives elsewhere."

  local env_path="$ENV_FILE"
  case "$env_path" in /*) ;; *) env_path="./$env_path" ;; esac
  # shellcheck disable=SC1090
  set -a
  # shellcheck disable=SC1090  # the path is the caller's env file, by design
  . "$env_path"
  set +a
  : "${DB_USER:?not set in $ENV_FILE}"
  : "${DB_NAME:?not set in $ENV_FILE}"
}

# The compose project name — the prefix Docker puts on the volumes, and the
# folder each stack gets in the bucket, so the sandbox's nightly dump can
# never land on top of the shop's.
ops_resolve_stack() {
  local stack
  stack="$(compose config --format json 2>/dev/null |
    sed -n 's/^[[:space:]]*"name":[[:space:]]*"\([^"]*\)".*/\1/p' | head -n 1 || true)"
  printf '%s' "${stack:-organza}"
}

# The bucket's layout, in one place so both scripts spell it the same way.
ops_db_prefix()      { printf '%s/database' "$1"; }
ops_uploads_prefix() { printf '%s/uploads' "$1"; }

# ---------------------------------------------------------------------------
#  Which deployment this is
# ---------------------------------------------------------------------------
# Asked of the RUNNING container rather than of a file, because that is where
# the answer actually lives: docker-compose.prod.yml sets APP_ENV in
# `environment:`, which overrides `env_file:` — so reading .env.production
# would report "unset" on the live shop and wave a restore straight through.
#
# When it cannot be determined at all, the answer is "production". That is the
# same way round as backend/src/lib/appEnv.ts: a missing value must never be
# the reason a guard stands down.
ops_app_env() {
  local value
  value="$(compose exec -T backend printenv APP_ENV 2>/dev/null | tr -d '\r\n' || true)"
  [ -n "$value" ] || value="${APP_ENV:-}"
  printf '%s' "${value:-production}"
}

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

# Every dump in the bucket for this stack, oldest first.
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
