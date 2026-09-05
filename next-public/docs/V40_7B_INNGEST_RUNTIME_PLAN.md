# V40.7b — Inngest fleet runtime

Implementation branch for #176.

This slice makes the governed V40.7 improvement work contract durable and executable while preserving the existing Resume/CV release boundary.

## Runtime rules

- 50 logical improvement seats; execution concurrency starts lower and is independently tunable.
- Inngest transports `sourcingos/fleet.v40_7.work.requested` work items.
- Supabase persists one durable row per work item and makes retries/idempotency visible to SourcingOS.
- No V40.7b path may claim or update Resume/CV sprint tasks.
- Any future Resume/CV runner must call only `claim_resume_sprint_tasks_v40_5i`.
- Experimental/paid providers remain double-gated and default closed.
- LinkedIn/account-gated scraping, access-control bypass, unattended contact harvesting, silent identity merge, autonomous outreach, and recruiting decisions remain blocked.

## Rollout

1. exact-head CI + Vercel Preview
2. Inngest function discovery/signing
3. one dry-run work item
4. one item per pod (5)
5. 10 items
6. 50 logical items only after idempotency/retry/concurrency telemetry is clean

Production activation is separate from logical fleet registration.
