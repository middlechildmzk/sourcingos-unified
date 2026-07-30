# V29.3A2 Recruiter QA Checklist

Use the exact PR head and preview deployment.

## Schema-unavailable state

Until the identity migrations receive separate production approval:

- Open `/app/identity-review` in an authenticated session.
- Confirm the page shows **Durable identity review is unavailable**.
- Confirm it states that no proposal, candidate, source profile, or database record was changed.
- Confirm no approval, rejection, attachment, or merge controls appear.
- Confirm Candidate Database still loads normally.
- Confirm Candidate Database links to Identity Review.
- Confirm legacy reviews, when present, are labeled read only.

## Activated disposable-schema state

This may be tested only against an isolated non-production database with the approved migrations applied.

- Confirm owner A cannot read owner B proposals.
- Confirm pending, deterministic, approved, rejected, and superseded queues load independently.
- Confirm an inaccessible proposal returns a not-found state.
- Confirm raw snapshots are not displayed.
- Confirm sensitive identifiers show only that an observed hash exists.
- Confirm contact-like field claims are masked.
- Confirm review rank is labeled as a ranking signal, not identity probability.
- Confirm deterministic rules, similarity components, and conflicts are visible together.
- Confirm no decision action exists.
- Confirm Candidate 360 and public source links resolve correctly.

## Release boundary

Do not apply migrations, create fixture proposals in production, or enable decisions as part of this QA pass.
