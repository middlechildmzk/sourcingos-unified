# V29.2 GitHub Person Discovery

## Objective

Make one technical sourcing lane dependable before adding more connectors.

The GitHub lane now answers four questions explicitly:

1. Why did this person surface?
2. Which public repository created the signal?
3. Was the result a person rather than a bot, organization, or artifact?
4. Did the source complete successfully, partially, or under a rate limit?

## Discovery strategy

### Primary: query-relevant repository contributors

1. Convert the role’s approved GitHub query into a bounded repository query.
2. Remove user-location qualifiers from repository search.
3. Search a maximum of three non-fork, non-archived public repositories.
4. Read the public contributor lists for those repositories.
5. Exclude bot and organization accounts.
6. Rank contributors by the number of relevant repositories and reported contributions.
7. Hydrate the highest-ranked public profiles when API capacity permits.
8. Return person records with repository-specific evidence.

A returned contribution signal means only that GitHub’s public contributor endpoint associated the account with that repository. It does not verify employment, ownership, seniority, identity, availability, clearance, or role fit.

### Fallback: public user search

When repository discovery produces no contributors, the lane falls back to GitHub user search. Fallback evidence is labelled as a discovery signal and never presented as repository contribution evidence.

## Result truth

GitHub results entering the candidate workflow must be `entityKind: person`.

The lane excludes:

- GitHub organizations
- Accounts typed as bots
- Common bot login patterns such as `[bot]`, `-bot`, `_bot`, `github-actions`, `dependabot`, and `renovate`
- Repository and package artifacts

Profile hydration failure does not erase already observed public contribution evidence. The result remains explicitly partial, uses the GitHub login as its display name, and returns a warning.

## Source diagnostics

The `/api/workbench/search-source` response now includes GitHub execution diagnostics:

- discovery strategy
- health: `healthy`, `degraded`, `rate_limited`, or `error`
- effective repository or fallback query
- duration
- repositories examined
- contributors examined
- profiles hydrated
- people returned
- bot accounts skipped
- partial-result state
- GitHub rate-limit remaining and reset time when available

Other source lanes receive a smaller generic diagnostic contract so the API boundary remains consistent.

## Rate-limit behavior

The connector uses `GITHUB_PERSON_DISCOVERY_TOKEN` when configured, then `GITHUB_TOKEN` as a fallback. It does not expose either token.

When GitHub returns a rate-limit response:

- the lane reports `rate_limited`
- the reset time is preserved when GitHub provides it
- no candidate-shaped fallback is fabricated
- any already observed partial results remain explicitly partial

## Guardrails

- Public evidence only
- No scraping of private profiles
- No inferred demographics
- No automatic contact enrichment
- No autonomous outreach
- No automatic identity merge
- No automatic candidate advancement
- No claim that repository contribution equals employment or verified expertise
- Only canonical person records may be saved or added to roles

## QA checklist

1. Search a technical role containing two or more concrete skill terms.
2. Confirm GitHub results cite the repository that caused each person to surface.
3. Confirm organizations and bots do not appear as people.
4. Confirm profile links open the matching public GitHub account.
5. Confirm evidence copy does not claim verified employment or role fit.
6. Confirm a failed profile hydration produces an explicitly partial result.
7. Confirm a GitHub rate-limit response produces no fabricated candidate result.
8. Confirm non-GitHub lanes still use their existing connector behavior.
9. Confirm repeat searches remain isolated by the V28 search-run guard.
10. Confirm saving remains person-only and idempotent.

## Release boundary

This slice changes application code only. It adds no database migration and performs no production data mutation.
