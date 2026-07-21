# SourcingOS security and role durability release

## Scope

This checkpoint hardens authentication, preview isolation, role ownership, Candidate Database recovery, stale-write detection, and durable role deletion without merging or promoting the draft branch to production.

## Authentication

- One Edge-safe configuration contract distinguishes Supabase authentication from durable service-role persistence.
- Middleware, route handlers, and server components share the same fail-closed auth-mode decision.
- Protected identity checks use Supabase Auth `getUser()` rather than trusting cookie-decoded sessions.
- Preview bypass is disabled in production and cannot coexist with authentication or durable persistence.
- Preview bypass never grants admin access.

## Role ownership and concurrency

- Parent role writes no longer use unrestricted upsert-by-id behavior.
- Existing role updates match role id, authenticated owner, and the expected server version.
- Existing role updates never reassign `owner_id`.
- Stale or versionless edits to existing roles return a conflict instead of overwriting newer account data.
- A locally retained role is not silently recreated when it has been deleted from the server.
- New roles use insert and return conflict when another request has already claimed the id.
- Child records are written only after the parent role write succeeds.
- Successful saves return and persist the next server version.

## Durable deletion

- The role API supports owner-scoped, version-scoped DELETE.
- Failed or stale deletion preserves the browser workspace.
- Deletion is disabled while storage mode is checking or disconnected.
- The role page exposes an explicit administration disclosure with a destructive-action confirmation.

## Database defense in depth

Migration path:

`next-public/supabase/migrations/20260721173000_role_workspace_owner_safety.sql`

The migration adds composite parent and child ownership constraints while preserving the existing server-only mutation architecture:

- Authenticated clients retain SELECT-only grants.
- Direct authenticated INSERT, UPDATE, and DELETE grants are revoked.
- Historical direct-write policies are removed defensively.
- Child SELECT policies verify both row ownership and parent role ownership.

The migration is committed but not applied.

Read-only production inspection found:

- Zero role workspace rows at inspection time.
- Zero orphaned child rows.
- Zero child rows whose owner differed from the parent role owner.
- Existing authenticated grants were already SELECT only.

## Candidate Database

A route-level recovery boundary provides retry and safe navigation without displaying raw runtime errors or unsupported persistence assurances.

## Dependencies and CI

- `next`, `@next/mdx`, and `eslint-config-next` are aligned at `14.2.35`.
- The lockfile was regenerated and verified on Linux and macOS while retaining cross-platform optional native packages.
- CI retains machine-readable Vitest and npm audit artifacts.
- Rate-limit tests freeze time at a stable bucket boundary to remove minute-window flakiness.

## Verification

- Locked install: PASS
- TypeScript: PASS
- Deterministic tests: 176/176 across 76 suites
- Production build: PASS
- Stable Vercel branch alias available

## Operational findings

- Preview runtime logs confirm Upstash is not configured, so the current fallback rate limiter is per serverless instance only.
- Supabase security advisors still flag the intentionally broad waitlist insert policy and disabled leaked-password protection.
- Supabase performance advisors contain existing warnings outside this role-durability checkpoint.

## Still required before merge

- Create a paid Supabase development branch after explicit cost approval.
- Apply and test the owner-safety migration there, then rerun advisors.
- Replace the remaining parent-then-children write sequence with one atomic database snapshot transaction.
- Complete authenticated desktop and mobile QA.
- Confirm the Supabase preview redirect allowlist.
- Configure Upstash for globally enforced rate limiting.
- Confirm `CRON_SECRET` and one successful scheduled invocation.
