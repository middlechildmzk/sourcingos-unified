# Held Supabase migrations

These SQL files are deliberately outside `supabase/migrations/`.

Supabase CLI applies timestamped SQL files from `supabase/migrations/` that are absent from the remote migration ledger. Keeping an unapproved file in that directory makes it eligible for `supabase db push`.

The files in this directory are preserved, reviewable release candidates. They are **not active migrations** and must not be copied back into the active directory without a dedicated release decision, a PostgreSQL rehearsal, and explicit production approval.

## Current decisions

| File | Decision | Required before activation |
|---|---|---|
| `20260701173000_jobs_v2_foundation.sql` | Held | Reconcile its additive job schema with the live job board and approve Jobs V2 as its own release. |
| `20260721173000_role_workspace_owner_safety.sql` | Held | Run an ownership-consistency preflight, review lock/constraint risk, and release separately from identity work. |
| `20260722160000_role_calibration_state.sql` | Held | Promote only with the intended role-calibration product release. |
| `20260730194500_transactional_identity_decisions.sql` | Held | Review and approve the complete identity-decision API, recruiter controls, audit behavior, rollback policy, and production migration plan together. |
| `20260730194600_transactional_identity_decision_serialization.sql` | Held companion | Must be activated in the same release as the preceding decision migration. It serializes same-profile decisions before row locking and must never be promoted independently. |

Moving a file here does not apply, revert, or repair anything in Supabase. Production remains unchanged.
