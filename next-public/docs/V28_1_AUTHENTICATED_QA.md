# V28.1 Authenticated QA

Run this checklist against the V28.1 preview before merging PR #45 or its parent branches.

## Public search

- Open `/candidate-search/` signed out.
- Confirm there is exactly one visible search entry point.
- Run a person-oriented search and confirm person results appear before source diagnostics.
- Confirm diagnostics remain collapsed while sources are still running.
- Confirm supporting artifacts and manual lanes are not presented as candidates.
- Confirm public save actions are gated.

## Signed-in search

- Open `/app/candidate-search/`.
- Run Search A, then immediately run Search B.
- Confirm delayed Search A responses never appear in Search B.
- Confirm source-lane status and market-map information belong to Search B only.
- Confirm a person row opens its evidence preview.
- Confirm an artifact or search lane cannot be saved or added to a role.

## Persistence

- Save one person result.
- Record the returned Candidate 360 ID.
- Save the same source profile again in a new tab or refreshed session.
- Confirm the same candidate ID is returned and no duplicate candidate is created.
- Confirm evidence and contact signals are not duplicated.
- Simulate or inspect required child-write failure handling and confirm the API never reports success after a failed required write.

## Candidate Database and Candidate 360

- Open `/app/candidate-database/`.
- Open candidates through the name and Open 360 action.
- Confirm browser back returns to the database with state intact.
- Refresh a Candidate 360 URL directly.
- Test an invalid ID and confirm a useful error state.

## Today consolidation

- Open `/app/today/` and confirm it is the canonical decision inbox.
- Open `/app/agent-os/` and confirm it permanently redirects to `/app/today/`.
- Confirm no visible navigation or action links to Agent OS as a separate home.

## Accessibility

- Complete the core search and candidate-open path using keyboard only.
- Confirm visible focus styles.
- Confirm row controls do not create invalid nested interactive semantics.
- Open Candidate Drawer and verify focus enters the dialog.
- Press Escape and confirm it closes.
- Confirm focus returns to the trigger.
- Confirm background content is not interactive while the drawer is open.

## Mobile and resilience

- Test public and signed-in search at approximately 390 px width.
- Confirm no horizontal page overflow.
- Test a connector timeout, error, and empty response.
- Confirm retry controls remain available inside collapsed diagnostics.
- Test browser refresh, back/forward, multiple tabs, and session expiration.

## Console and network

- Keep browser console and network panel open for every major path.
- Record any client exception, failed request, duplicate request, 401/403/409/422/500 response, or hydration warning.
- Redact candidate/contact information from screenshots and bug reports.

## Release gate

Do not merge until:

- GitHub CI is green.
- Vercel preview is READY.
- This checklist has no P0 or P1 failures.
- No production database mutation has occurred.
