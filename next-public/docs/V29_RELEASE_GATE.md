# V29.0 Release Gate

This document defines the final gate for the role-centric sourcing loop before merge into `main`.

## Automated gate status

Exact release-candidate head: `065d02941e5477b3625318cbea616174b89f4371`

- Locked dependency install: passed.
- TypeScript: passed.
- Deterministic tests: 253 of 253 passed across 103 of 103 suites.
- Atomic role migration contract: passed.
- Dependency audit reports: captured.
- Production Next.js build: passed.
- Static generation: 116 of 116 pages.
- Exact-head Vercel preview: READY.
- Preview runtime error, warning, and fatal sweep: no matching logs.

Preview deployment: `dpl_7np1Y6kULf5phKaR1ngfmTGworrN`

## Required authenticated workflow

1. Sign in.
2. Create or open a role.
3. Approve at least one search lane.
4. Launch **Search this role**.
5. Confirm the role title, location, skills, work mode, clearance breadcrumb, and approved lane context are present.
6. Edit the search draft without changing the approved role record.
7. Run the search.
8. Open a person result.
9. Save the person and add them to the active role.
10. Confirm the canonical candidate appears exactly once in the role review queue.
11. Repeat the save and confirm no duplicate candidate or activity event is created.
12. Open Candidate 360.
13. Use **Back to role queue** and confirm the exact role is restored.
14. Open Today and confirm one candidate decision is present.
15. Verify an artifact, organization, search lane, or unknown entity cannot enter the candidate queue.
16. Repeat the primary workflow at mobile width and with keyboard navigation.

## Release boundaries

- No production database mutation is part of V29.0.
- No migration is applied by this release.
- No autonomous outreach is introduced.
- No silent identity merge is introduced.
- No clearance or availability signal becomes a verified claim.
- Database durability and provenance reconciliation remain a separately rehearsed and approved track.

## Merge decision

The automated and exact-head preview gates are complete. PR #47 remains unmerged until the authenticated workflow is accepted. After merge, verify Roles, Candidate Search, Candidate 360, Today, runtime logs, and production deployment health before beginning V29.1.
