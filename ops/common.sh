#!/usr/bin/env bash
# Shared by backup.sh and restore.sh so they agree on the stack, the bucket layout and dump verification. Sourced, never run.

# One STACK word picks both files: separate COMPOSE_FILE/ENV_FILE once backed up the sandbox under production's name.
STACK="${STACK:-sandbox}"

# Captured before anything below assigns them, so a caller's value can be refused in ops_load_env.
OPS_INHERITED_COMPOSE_FILE="${COMPOSE_FILE:-}"
OPS_INHERITED_ENV_FILE="${ENV_FILE:-}"

STACK_PRODUCTION="production"
STACK_SANDBOX="sandbox"

# A sandbox database must say so in its own name (the same marker import:prod uses).
SANDBOX_DATABASE_MARKER="sandbox"

# Pinned rather than latest: an unattended nightly run is no time to meet a changed default.
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

# A stack's project name (volume prefix, bucket folder) is STACK_NAME in its env file, else FROM_STACK_NAME.
ops_stack_project() {
  local file name
  if [ "$1" = "${STACK:-}" ] && [ -n "${STACK_NAME:-}" ]; then printf '%s' "$STACK_NAME"; return; fi
  file="$(ops_stack_env_file "$1")"
  if [ -f "$file" ]; then
    name="$(sed -n 's/^STACK_NAME=["'\'']\{0,1\}\([^"'\'']*\).*$/\1/p' "$file" | head -n 1)"
  fi
  name="${name:-${FROM_STACK_NAME:-}}"
  [ -n "$name" ] || die "no STACK_NAME for stack \"$1\": set it in $file, or pass FROM_STACK_NAME=<its compose project name>."
  printf '%s' "$name"
}

compose() { docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" "$@"; }

# Sets COMPOSE_FILE, ENV_FILE, STACK_PROJECT, DB_USER, DB_NAME and R2_* from the one STACK word, refusing a mixture.
ops_load_env() {
  # The old COMPOSE_FILE/ENV_FILE interface fails loudly instead of half-working.
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

  [ -f "$COMPOSE_FILE" ] || die "no $COMPOSE_FILE here. cd to the directory that holds it."
  [ -f "$ENV_FILE" ]     || die "no $ENV_FILE here — STACK=$STACK expects that file next to $COMPOSE_FILE."

  local env_path="$ENV_FILE"
  case "$env_path" in /*) ;; *) env_path="./$env_path" ;; esac
  set -a
  # shellcheck disable=SC1090  # the path is the chosen stack's env file, by design
  . "$env_path"
  set +a
  : "${DB_USER:?not set in $ENV_FILE}"
  : "${DB_NAME:?not set in $ENV_FILE}"
  : "${STACK_NAME:?not set in $ENV_FILE — it is the compose project name the volumes carry}"
  STACK_PROJECT="$STACK_NAME"

  ops_assert_stack_matches_database
}

# Second check: the database the files point at must belong to the named stack.
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

# Third check, against the running deployment: a disagreement aborts, an unreadable answer only warns.
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

# APP_ENV is read from the running container (compose's environment: wins); unknown counts as production, so guards never relax.
ops_probe_app_env() {
  compose exec -T backend printenv APP_ENV 2>/dev/null | tr -d '\r\n' || true
}

ops_app_env() {
  local value
  value="$(ops_probe_app_env)"
  printf '%s' "${value:-$STACK_PRODUCTION}"
}

# One header with every value that decides what was touched, so a cron log answers which stack ran.
ops_print_target() {
  echo "  Stack    : $STACK  (project $STACK_PROJECT)"
  echo "  Compose  : $COMPOSE_FILE"
  echo "  Env file : $ENV_FILE"
  echo "  Database : $DB_NAME"
}

ops_db_prefix()      { printf '%s/database' "$1"; }
ops_uploads_prefix() { printf '%s/uploads' "$1"; }

ops_require_r2() {
  : "${R2_BUCKET:?not set in $ENV_FILE — see backend/.env.example, 'Off-site backups (Cloudflare R2)'}"
  : "${R2_ACCESS_KEY_ID:?not set in $ENV_FILE}"
  : "${R2_SECRET_ACCESS_KEY:?not set in $ENV_FILE}"
  # Only the account id is needed; the endpoint is for buckets behind a custom domain.
  if [ -z "${R2_ENDPOINT:-}" ]; then
    : "${R2_ACCOUNT_ID:?set either R2_ENDPOINT or R2_ACCOUNT_ID in $ENV_FILE}"
    R2_ENDPOINT="https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com"
  fi
}

# Photos are reached with --volumes-from the backend, so no script depends on Docker's volume name; OPS_WORK_DIR mounts at /work.
OPS_BACKEND_CONTAINER=""
ops_backend_container() {
  if [ -z "$OPS_BACKEND_CONTAINER" ]; then
    OPS_BACKEND_CONTAINER="$(compose ps -q backend)"
    [ -n "$OPS_BACKEND_CONTAINER" ] ||
      die "the backend container is not running — start the stack first (docker compose up -d)."
  fi
  printf '%s' "$OPS_BACKEND_CONTAINER"
}

# R2 rejects the checksum headers AWS CLI 2.23+ sends by default; when_required restores the old behaviour.
r2() {
  local work_mount=()
  [ -n "${OPS_WORK_DIR:-}" ] && work_mount=(-v "$(cd "$OPS_WORK_DIR" && pwd)":/work)

  # Credentials go in through a private temp file, never -e, which leaks into argv and docker inspect.
  local env_file
  env_file="$(mktemp)"
  # shellcheck disable=SC2064  # $env_file is expanded now, on purpose
  trap "rm -f '$env_file'" RETURN
  chmod 600 "$env_file"
  {
    printf 'AWS_ACCESS_KEY_ID=%s\n' "$R2_ACCESS_KEY_ID"
    printf 'AWS_SECRET_ACCESS_KEY=%s\n' "$R2_SECRET_ACCESS_KEY"
  } > "$env_file"

  docker run --rm \
    --volumes-from "$(ops_backend_container)" \
    "${work_mount[@]}" \
    --env-file "$env_file" \
    -e AWS_REQUEST_CHECKSUM_CALCULATION=when_required \
    -e AWS_RESPONSE_CHECKSUM_VALIDATION=when_required \
    "$AWS_CLI_IMAGE" \
    --endpoint-url "$R2_ENDPOINT" --region auto "$@"
}

# Timestamped keys sort by age lexically, so no dates or mtimes are trusted.
ops_list_dumps() {
  local prefix="$1"
  r2 s3api list-objects-v2 --bucket "$R2_BUCKET" --prefix "$prefix/" \
    --query 'sort_by(Contents,&Key)[].Key' --output text 2>/dev/null |
    tr '\t' '\n' | grep -v '^None$' | grep . || true
}

# Verified as a FILE in the db container (pipes cannot seek) and read through to /dev/null, so truncated dumps fail; see selftest.sh.
ops_verify_dump() {
  local local_file="$1"
  local remote rc=0
  remote="/tmp/store-verify-$$-$(basename "$local_file")"

  compose cp "$local_file" "db:$remote" >/dev/null 2>&1 || {
    echo "could not copy the dump into the db container to verify it" >&2
    return 1
  }
  compose exec -T db pg_restore --file=/dev/null "$remote" >/dev/null 2>&1 || rc=1
  compose exec -T db rm -f "$remote" >/dev/null 2>&1 || true

  return $rc
}
