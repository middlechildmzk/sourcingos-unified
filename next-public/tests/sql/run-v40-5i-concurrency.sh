#!/usr/bin/env bash
# Proves the V40.5i canary ceiling holds under genuinely CONCURRENT claims.
#
# Two overlapping transactions each try to claim a full canary's worth of
# resume_search rows. Worker A claims and then holds its transaction open;
# worker B starts while A is still uncommitted. Without serialization B reads
# "0 admitted" (A's writes are invisible) and admits a second full canary,
# producing 12 admitted candidates against a ceiling of 6. With the
# transaction-scoped advisory lock, B blocks until A commits, then correctly
# observes 6 and admits none.
#
# FOR UPDATE SKIP LOCKED alone does NOT prevent this: it stops two workers
# taking the SAME row, but lets them take DIFFERENT rows.
#
# Prints: concurrent_overlap_admits_at_most_6|<actual>|6|PASS|FAIL
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PSQL="${PSQL:-psql}"
CEILING="${CEILING:-6}"

PSQL="$PSQL" "$HERE/setup-v40-5i-db.sh"
$PSQL -v ON_ERROR_STOP=1 -q -c "select public.seed_sprint(40, 0);"

# Worker A: claim, then hold the transaction open so its writes stay uncommitted
# while worker B runs.
$PSQL -v ON_ERROR_STOP=1 -q >/dev/null 2>&1 <<SQL &
begin;
select count(*) from public.claim_resume_sprint_tasks_v40_5i(36,'concurrent-a',now(),${CEILING},false);
select pg_sleep(3);
commit;
SQL
A_PID=$!

sleep 1   # ensure A is inside its transaction, holding the lock, before B starts

# Worker B: overlaps A. Must not be able to admit a second canary.
$PSQL -v ON_ERROR_STOP=1 -q >/dev/null 2>&1 <<SQL &
begin;
select count(*) from public.claim_resume_sprint_tasks_v40_5i(36,'concurrent-b',now(),${CEILING},false);
commit;
SQL
B_PID=$!

wait $A_PID || true
wait $B_PID || true

ACTUAL=$($PSQL -t -A -c "select public.admitted_count();")
if [ "$ACTUAL" -le "$CEILING" ]; then VERDICT=PASS; else VERDICT=FAIL; fi
echo "concurrent_overlap_admits_at_most_${CEILING}|${ACTUAL}|${CEILING}|${VERDICT}"
