# Privacy and security contact governance

This beta release adds a dedicated public contact channel for privacy requests, candidate-data concerns/removal requests, security reports, and general product questions.

## Trust boundaries

- Contact requests are accepted only by the rate-limited `/api/contact` server route.
- The backing `contact_requests` table has RLS enabled and no `anon` or `authenticated` Data API privileges.
- `/.well-known/security.txt` points to the HTTPS contact route rather than publishing a personal email address.
- Security reporters are asked not to submit credentials, access tokens, API keys, or unnecessary personal data.
- Candidate-data access/removal requests may require reasonable identity verification before disclosure or deletion.
- During beta, candidate data has no automatic time-based expiry. The public privacy policy states the current behavior rather than promising a retention mechanism that does not exist yet.

## Next governance slice

Candidate deletion is cross-table and must be implemented as an owner-scoped server operation rather than a raw client delete. The Candidate Graph currently fans candidate-linked data across canonical candidates, source profiles, evidence, contacts, role state, acquisition history, quality snapshots, refresh/enrichment state, and AutoSource state. The hard-delete routine should be implemented and regression-tested before broader candidate-data ingestion.
