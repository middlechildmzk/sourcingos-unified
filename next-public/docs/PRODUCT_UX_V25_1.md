# SourcingOS Product UX V25.1

## Product principle

SourcingOS should feel like a recruiting teammate, not a collection of sourcing utilities.

The recruiter should primarily see:

1. Decisions that need human judgment.
2. Roles and their current health.
3. Candidates ready for review.
4. Clear evidence for why the system recommends an action.

Infrastructure, connector settings, raw payloads, sync state, source cursors, graph internals, memory internals, and operational diagnostics belong behind progressive disclosure or in an administrative surface.

## Primary information architecture

### Today

The default workspace and recruiter command center.

Show:

- Pending strategy and memory approvals.
- Prioritized candidates.
- Daily recruiting brief.
- Active agent workflow status.
- Roles ready to launch.

Do not lead with:

- Connector configuration.
- Raw JSON.
- Database totals.
- Migration or persistence language.
- Internal version numbers.

### Roles

A role is the center of the recruiting workflow.

Each role should bring together:

- Intake and calibration.
- Search strategy.
- Candidate review.
- Pipeline movement.
- Activity history.
- Agent status.

Backup, synchronization, and advanced search controls remain available but should not interrupt the main role flow.

### AutoSource

AutoSource owns autonomous discovery operations.

Primary tasks:

- Review ambiguous identities.
- See active campaigns.
- Pause, activate, or run a campaign.
- Create a custom campaign when needed.

Candidate review and role routing should surface on Today rather than creating a second daily inbox.

### Candidates

Candidates owns the canonical Candidate Graph and Candidate 360.

Primary tasks:

- Find a known person.
- Review evidence and identity confidence.
- Understand relationships and professional history.
- Add the candidate to a role.
- Request deeper enrichment.

## Interaction patterns

### Persistent role and workspace context

The product should maintain context while the recruiter moves between strategy, discovery, review, and pipeline work. Avoid making users reconstruct the same role or search context on every page.

### Progressive disclosure

Use expandable sections for:

- Raw agent payloads.
- Recruiter-memory evidence.
- Talent-graph internals.
- Source and connector controls.
- Backup and synchronization.
- Technical safety details.

### Action-oriented rows

Prefer compact rows over large repeated cards when displaying campaigns, candidates, approvals, roles, and workflow runs.

Each row should answer:

- What is this?
- Why does it matter?
- What state is it in?
- What is the next action?

### One daily queue

Approvals and prioritized candidates should converge on Today. Avoid separate inboxes that compete for recruiter attention.

### Evidence before automation

For sensitive decisions, show the source, identity confidence, role relevance, and reason before presenting an approval action.

### Human control

Keep explicit approval gates for:

- Search strategy activation.
- Ambiguous identity promotion.
- Recruiter-memory changes.
- Candidate disposition.
- Outreach.

## Competitive pattern notes

The direction takes inspiration from current category patterns without copying any product's visual identity:

- Role-centered workspaces that combine search, evaluation, shortlist, and action.
- Persistent left navigation with a small number of primary destinations.
- Agent activity presented as outcomes and checkpoints rather than technical execution logs.
- Funnel and progress summaries that remain secondary to recruiter decisions.
- Search and campaign creation available on demand rather than permanently occupying the main screen.

Reference products reviewed during this sprint:

- hireEZ
- Juicebox
- SeekOut
- Metaview
- Pin

## Visual direction

- Restrained dark enterprise surfaces.
- One accent color for active state and focus.
- Compact status pills.
- Lower card radius and less decorative gradient use.
- Strong page hierarchy with modest typography.
- Dense but readable operational rows.
- Mobile navigation as a drawer.
- Accessible focus, contrast, and button labeling.

## Next UX milestones

1. Convert Candidate Database to the shared shell and compact table/row system.
2. Build a unified role detail route with tabs for Overview, Candidates, Strategy, and Activity.
3. Add global search and command palette.
4. Create a candidate-review drawer so users do not lose role context.
5. Add empty-state onboarding and sample workflow guidance.
6. Separate recruiter settings from admin and data operations.
7. Run browser verification at desktop and mobile widths after every major flow change.
