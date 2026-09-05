# V36.7 Recruiter Review Acceptance Contract

V36.7 is a recruiter-loop hardening slice stacked on V36.6. It does not make employment decisions and does not merge/deploy production.

## North-star acceptance query

`find me a RHEL administrator with 5+ years of linux experience local to Annapolis Junction, MD or greater Washington DC with a secret clearance or higher`

## Required behavior

1. Recruiter-approved search geography includes the canonical anchor, recruiter-stated alternate markets, and explicitly approved location expansions.
2. A person with observed RHEL/Linux evidence in the approved DMV geography is not withheld merely because 5+ years or Secret clearance is not publicly verified.
3. Missing tenure, clearance, or location is `Promising — Verify`, never an automatic rejection.
4. `Held` means the record remains inspectable; it is not a recruiter decision.
5. The sourcing funnel exposes people assessed, Review Ready, Promising — Verify, and Held counts with hold reasons.
6. Related/adjacent search chips create a visible, persistent Active Search Expansion state and can be removed individually.
7. Discovery cards show source-provided avatar when available, observed location or `Location not observed`, source/profile URL, available public contact signals, skills/evidence, and admission explanation.
8. Source criteria, approved search expansions, role location, and clearance requirements never become candidate facts.
9. No guessed LinkedIn URL, email, candidate residence, clearance, tenure, or cross-source identity.
10. Recruiter remains responsible for Yes / Maybe / No and explicit persistence to Candidate Graph.

## Release gate

A safe-but-empty regression is a failure. V36.7 must preserve the hard trust gates while reducing false withholding of relevant candidates with incomplete public evidence.
