# SourcingOS V25.1 Release Summary

## Outcome

SourcingOS is now a role-centered recruiter operating system rather than a collection of disconnected sourcing utilities.

## Primary recruiter experience

- **Today:** approvals, prioritized candidates, daily brief, and active agent work.
- **Roles:** calibrated intake, strategy, candidates, pipeline, and activity.
- **AutoSource:** discovery campaigns and ambiguous identity review.
- **Candidates:** searchable Candidate Graph and evidence-first Candidate 360.

Secondary sourcing and data utilities are grouped under **Tools & data**.

## Autonomous workflow

A role-launch workflow can:

1. Analyze an intake.
2. Propose sourcing strategy.
3. Pause for recruiter approval.
4. Activate an AutoSource campaign.
5. Produce a prioritized review queue.
6. Propose repeated calibration patterns.
7. Pause before applying recruiter memory.
8. Hand control back to the recruiter for candidate movement and outreach decisions.

## Candidate Graph

- 27K+ existing canonical candidates in the connected Supabase project at the time of implementation.
- Exact graph counts.
- Bounded server-side search and pagination.
- Source-profile provenance.
- Evidence, contact, and availability signals.
- Owner-scoped durable resume and CSV imports.
- Candidate 360 actions for role handoff, enrichment, freshness, and graph extraction.

## Trust controls

- No automatic outreach.
- No automatic candidate rejection.
- No authenticated-platform scraping.
- No silent identity merge.
- No unapproved recruiter-memory changes.
- Contact, availability, clearance, employment, and identity are not treated as verified without evidence and recruiter review.

## Operations

- Supabase migrations for role workspace, acquisition, AutoSource, and Agent OS are applied.
- Orchestration route is protected by `CRON_SECRET`.
- Vercel Hobby schedule is once daily at `0 12 * * *`.
- A higher cadence requires a compatible Vercel plan or external scheduler.
