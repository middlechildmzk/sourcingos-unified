# SourcingOS V20 — Role Workspace Daily Driver

## Product decision

V20 changes SourcingOS from a collection of sourcing tools into a role-centered operating workflow. Recruiters work from an active role and move through intake, approved search lanes, candidate review, evidence review, contact research, pipeline stages, and activity history.

## Delivered in this slice

- `/app/roles` private workspace
- JD/intake parsing into recruiter-editable requirements
- Role status and req-load navigation
- Multi-lane sourcing plans that reuse Candidate Database and Network before external discovery
- Recruiter approval/pause controls for search lanes
- Manual candidate capture for calibration batches
- Role-specific fit decisions and rationale
- Evidence/contact state tracking without claiming verification
- Recruiter-controlled pipeline stages
- Next-best-action guidance
- Feedback-derived calibration pattern suggestions after a minimum sample
- Activity/audit history
- Browser-local persistence for protected previews while Supabase is unavailable
- Deterministic domain tests

## Current persistence boundary

The connected Supabase project is inactive, so V20 uses browser-local storage in preview. This makes the workflow usable for evaluation without uploading candidate records to a shared preview database.

Do not treat browser-local storage as a production system of record. Before durable beta:

1. Restore and audit the SourcingOS Supabase project.
2. Reconcile the existing `projects` schema and project API with the V20 domain.
3. Add owner-scoped role candidate, activity, and calibration persistence.
4. Run two-user RLS isolation tests.
5. Add export/backup and idempotent import before real candidate usage.

## Workflow

```text
Create role
  -> Review calibrated intake
  -> Approve search lanes
  -> Add initial candidate batch
  -> Record fit decisions and evidence concerns
  -> Review calibration insights
  -> Refine search plan
  -> Move candidates through recruiter-controlled pipeline
  -> Hand off to Candidate 360 / Evidence Ledger / contact research
```

## Trust boundaries

V20 does not:

- auto-merge candidate identities
- claim contact ownership, consent, clearance, employment, or availability
- auto-send outreach
- automatically reject or disposition candidates
- scrape authenticated platforms
- silently change search strategy
- turn a role-specific fit decision into a global candidate rating

## Next implementation slice

- Durable role persistence using the existing authenticated project APIs
- Search results saved directly into the selected role
- Candidate Database and Network "Add to role" actions
- Candidate 360 V2 linked to V19 claim IDs
- Approval-gated contact research and Gmail drafts
- Scheduled source refresh and recruiter alerts
