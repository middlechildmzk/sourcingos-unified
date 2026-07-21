# SourcingOS authenticated security and durability QA

Run this checklist against the latest Vercel preview after GitHub CI is green.
Use the approved beta account in one browser session and the newest magic link.

## Automated release evidence

Latest role-durability checkpoint:

- Locked Linux install: PASS
- Cross-platform lockfile generation and macOS locked install: PASS
- TypeScript: PASS
- Deterministic tests: 176/176 across 76 suites
- Production build: PASS
- Stable branch alias: `https://sourcingos-unified-git-v20-role-0eef77-middlechildmzks-projects.vercel.app`

The owner-safety migration is committed but has not been applied to Supabase.

## Authentication

1. Open `/app` while signed out. Confirm redirect to `/login`.
2. Sign in from the preview. Confirm the callback returns to the same preview host.
3. Open `/app/candidate-database` and `/app/roles` after sign-in.
4. Sign out and confirm protected routes redirect again.
5. Confirm preview-bypass headers appear only on an intentionally isolated preview with no Supabase auth or durable persistence variables.

## Candidate Database recovery

1. Load Candidate Database with clean browser storage.
2. Load with legacy role-workspace storage if available.
3. Simulate an API or render failure and confirm the recoverable page appears.
4. Confirm Retry works.
5. Confirm Back to Candidates and Back to Roles work.
6. Confirm no raw JavaScript, database, or environment error is displayed.

## Role ownership, versions, and persistence

1. Create a role and wait for the server version confirmation.
2. Refresh and confirm the role restores from the account.
3. Add a candidate, refresh, and confirm it restores.
4. Record a fit decision, refresh, and confirm it restores.
5. Open the same role in a second browser session. Save a change there, then attempt to save the stale first session. Confirm the stale save is rejected with a refresh instruction.
6. Delete a role from Role administration. Confirm the warning names the role and explains that role candidates, lanes, and activity are removed.
7. Confirm deletion is disabled while account storage is checking or disconnected.
8. Confirm a successful deletion returns to Roles and the deleted workspace does not reappear after refresh.
9. In a separate authorized test account, confirm the first account’s roles are not visible.
10. After applying the owner-safety migration in a non-production test project, confirm authenticated clients retain SELECT-only table grants.
11. Run cross-owner child-row INSERT attempts with the service role in the test project. Confirm the composite `(role_id, owner_id)` foreign keys reject mismatched owners.

## Infrastructure checks

1. Confirm `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` are configured for Preview and Production. Without them, rate limiting is per serverless instance only.
2. Confirm `CRON_SECRET` is configured and record one successful scheduled invocation.
3. Confirm the Supabase preview callback wildcard or exact branch callback is allowlisted.
4. Run Supabase security and performance advisors after applying the migration in the test branch.

## Responsive smoke test

Check Today, Roles, AutoSource, Candidates, Candidate 360, the role candidate drawer, and Role administration at:

- 1440 px
- 1280 px
- 1024 px
- 768 px
- 390 px

Record browser-console errors, network failures, and screenshots for any issue.

## Remaining evidence to record

- Supabase development-branch migration result and advisor output
- Authenticated desktop and mobile screenshots
- Browser-console results
- Preview callback allowlist confirmation
- Upstash environment confirmation
- `CRON_SECRET` confirmation and one successful scheduled invocation
- Atomic role snapshot transaction result
