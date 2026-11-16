#!/usr/bin/env bash
#
# Organza — prove the backup's own safety checks actually work.
#
#   STACK=production ./ops/selftest.sh
#   STACK=sandbox    ./ops/selftest.sh
#
# Read-only. It takes a dump, checks it, damages a COPY of it and checks that
# too. It never uploads, never prunes and never touches the database, the
# uploads volume or the bucket.
#
# WHY THIS EXISTS
#   The dump verification in ops/backup.sh was once written as
#
#       compose exec -T db pg_restore --list /dev/stdin < dump
#
#   which cannot work: a custom-format archive keeps its table of contents at
#   the end and seeks back to it, and `compose exec -T` supplies a pipe. So the
#   check failed on every dump ever taken — and because it fails CLOSED, the
#   backup aborted every night and uploaded nothing at all. It read like
#   corruption; it was the check being impossible.
#
#   A check that can only fail and a check that can only pass are the same kind
#   of bug: neither one is looking at anything. This script pins down both ends
#   so it cannot silently invert again.
#
#      1. a dump straight out of pg_dump              -> must PASS
#      2. the same dump with its tail cut off         -> must FAIL
#      3. a file that is not an archive at all        -> must FAIL
#
# Run it after any change to the verification, and on the server the first time
# the backup is set up.
set -euo pipefail

OPS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=ops/common.sh
. "$OPS_DIR/common.sh"

while [ $# -gt 0 ]; do
  case "$1" in
    --stack)   STACK="${2:?--stack needs production or sandbox}"; shift 2 ;;
    --stack=*) STACK="${1#*=}"; shift ;;
    *) echo "usage: ./ops/selftest.sh [--stack production|sandbox]" >&2; exit 2 ;;
  esac
done

ops_load_env

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

PASSED=0
FAILED=0

# `ops_verify_dump` is the thing under test. These assert on its EXIT STATUS,
# which is the only thing its callers act on.
expect() {
  local want="$1" label="$2" file="$3" got=0
  ops_verify_dump "$file" || got=1
  if [ "$got" = "$want" ]; then
    echo "  ✔ $label — $([ "$want" = 0 ] && echo "accepted" || echo "rejected"), as it should be"
    PASSED=$((PASSED + 1))
  else
    echo "  ✖ $label — expected $([ "$want" = 0 ] && echo "accept" || echo "reject"), got the opposite"
    FAILED=$((FAILED + 1))
  fi
}

echo "$RULE"
echo "  Organza — backup self-test"
echo "$RULE"
ops_print_target
echo "$RULE"

echo "==> Taking a dump to test against (nothing is uploaded)"
compose exec -T db pg_dump -U "$DB_USER" -d "$DB_NAME" --clean --if-exists -Fc -Z 9 \
  > "$WORK/good.dump" 2>"$WORK/dump.err" ||
  die "pg_dump failed, so there is nothing to test: $(tr '\n' ' ' < "$WORK/dump.err" | tail -c 300)"
GOOD_BYTES="$(wc -c < "$WORK/good.dump" | tr -d ' ')"
echo "    $GOOD_BYTES bytes"
[ "$GOOD_BYTES" -gt 1024 ] || die "that dump is only $GOOD_BYTES bytes — too small to be a real archive."

# 1. The dump as pg_dump wrote it.
expect 0 "a valid dump" "$WORK/good.dump"

# 2. Truncated — what a full disk or a killed process leaves behind. Cut to
#    half, so the header is intact and the table of contents at the end is
#    gone: the case a naive "is the file non-empty?" check would wave through.
head -c "$((GOOD_BYTES / 2))" "$WORK/good.dump" > "$WORK/truncated.dump"
expect 1 "a dump truncated to half its length" "$WORK/truncated.dump"

# 3. Not an archive at all — a stage that wrote an error message where a dump
#    should have gone.
printf 'pg_dump: error: connection to server failed\n' > "$WORK/garbage.dump"
expect 1 "a file that is not an archive" "$WORK/garbage.dump"

echo "$RULE"
if [ "$FAILED" -eq 0 ]; then
  echo "  ✔ $PASSED/3 — the dump check accepts good dumps and rejects damaged ones."
  echo "$RULE"
  exit 0
fi

echo "  ✖ $FAILED of 3 checks behaved the wrong way round."
echo ""
echo "  Do not trust ops/backup.sh until this passes. If a VALID dump is being"
echo "  rejected, the backup is aborting every night and uploading nothing; if a"
echo "  TRUNCATED one is accepted, the backups are not being checked at all."
echo "  See ops_verify_dump in ops/common.sh."
echo "$RULE"
exit 1
