#!/usr/bin/env bash
# Applies the V40.5i migration to a scratch database and runs the executable
# canary-admission proof against it. Prints one row per scenario as:
#   label|actual|expected|PASS|FAIL
#
# Usage: PSQL="psql -h /tmp -p 5433 -U postgres" ./run-v40-5i-canary-admission.sh
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PSQL="${PSQL:-psql}" "$HERE/setup-v40-5i-db.sh"
${PSQL:-psql} -v ON_ERROR_STOP=1 -q -t -A -F '|' -f "$HERE/v40-5i-canary-admission.sql"
