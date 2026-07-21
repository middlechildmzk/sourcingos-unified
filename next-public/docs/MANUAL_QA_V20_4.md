# SourcingOS V20.4 authenticated QA

Run this checklist against the latest Vercel preview after GitHub CI is green.
Use the approved beta account in one browser session and the newest magic link.

## Authentication

1. Open `/app` while signed out. Confirm redirect to `/login`.
2. Sign in from the preview. Confirm the callback returns to the same preview host.
3. Open `/app/candidate-database` and `/app/roles` after sign-in.
4. Sign out and confirm protected routes redirect again.
5. Confirm preview-bypass headers appear only on an intentionally isolated preview with no Supabase auth or durable persistence variables.

## Candidate Database recovery

1. Load Candidate Database with clean browser storage.
2. Load with legacy role-workspace storage if available.
3. Simulate an API/render failure and confirm the recoverable page appears.
4. Confirm Retry works.
5. Confirm Back to Candidates and Back to Roles work.
6. Confirm no raw JavaScript, database, or environment error is displayed.

## Role ownership and persistence

1. Create a role and wait for the “Saved to your account” state.
2. Refresh and confirm the role restores.
3. Add a candidate, refresh, and confirm it restores.
4. Record a fit decision, refresh, and confirm it restores.
5. In a separate authorized test account, confirm the first account’s roles are not visible.
6. After applying the V20.4 migration in a non-production test project, run cross-owner INSERT and UPDATE attempts for roles, lanes, candidates, and activity. Confirm PostgreSQL rejects every attempt.

## Responsive smoke test

Check Today, Roles, AutoSource, Candidates, Candidate 360, and the role candidate drawer at:

- 1440 px
- 1280 px
- 1024 px
- 768 px
- 390 px

Record browser-console errors, network failures, and screenshots for any issue.

## Release evidence to record

- GitHub head SHA
- GitHub Actions run URL and exact test count
- Vercel preview URL
- Supabase migration status (not applied / test / production)
- Browser and device used
- Remaining failures
