# V28.1 Authenticated QA

Complete this checklist against the final Vercel preview before merging or promoting code.

## Environment record

- Preview URL:
- Branch:
- Commit SHA:
- Tester:
- Browser and version:
- Desktop viewport:
- Mobile viewport:
- Signed-in account:
- Test date:

## Public Candidate Search

- [ ] `/candidate-search/` loads without authentication.
- [ ] One visible search entry point appears above the fold at 1280 x 800.
- [ ] No V2.5 builder or second composer is present.
- [ ] Submit a technical search and confirm candidate people appear before source diagnostics.
- [ ] Source coverage remains collapsed while results stream.
- [ ] Market-map details remain below results.
- [ ] A package or repository result appears only under Supporting source subjects.
- [ ] A search-lane result appears only under Supporting source subjects.
- [ ] Public save action opens the access prompt rather than writing data.
- [ ] External source links open safely in a new tab.

## Signed-in Candidate Search

- [ ] `/app/candidate-search/` loads in the signed-in shell.
- [ ] Run Search A, then immediately run Search B.
- [ ] Delayed Search A responses never appear in Search B.
- [ ] Search A cannot change Search B source statuses or loading state.
- [ ] Person rows show name, headline, location, match evidence, skills, and actions.
- [ ] Non-person subjects are separated and cannot be saved.
- [ ] Open a person profile using mouse.
- [ ] Open a person profile using keyboard.
- [ ] Drawer focus moves to the close button.
- [ ] Tab and Shift+Tab remain within the drawer.
- [ ] Escape closes the drawer.
- [ ] Focus returns to the triggering result.
- [ ] Background page does not scroll while the drawer is open.

## Save and Candidate 360

Use a disposable test person record, not a production-sensitive candidate.

- [ ] Save a person source profile.
- [ ] Record returned candidate ID.
- [ ] Save the exact same source profile again.
- [ ] Confirm the same candidate ID is returned.
- [ ] Confirm no duplicate candidate, evidence, or contact row is created.
- [ ] Confirm a package, organization, unknown DEV account, or search lane returns HTTP 422 when save is attempted directly.
- [ ] Open Candidate 360 from the saved result.
- [ ] Refresh Candidate 360.
- [ ] Use browser Back and confirm search context remains usable.
- [ ] Test an invalid candidate ID and confirm a graceful state.
- [ ] Confirm source evidence and unverified contact labels remain intact.

## Candidate Database

- [ ] `/app/candidate-database/` loads.
- [ ] The primary list heading is People.
- [ ] Authorized legacy LinkedIn connection records appear as people.
- [ ] `devops` or other known package records do not appear in the main People list.
- [ ] Supporting or unclassified records appear only in the collapsed secondary section.
- [ ] Non-person records have no Add to Role action.
- [ ] Clicking the row surface opens Candidate 360.
- [ ] Keyboard focus on the row link is visible.
- [ ] Open 360 and Add to Role remain independently operable.
- [ ] Previous and Next pagination work.
- [ ] Search and Clear preserve accurate page state.

## Today and navigation

- [ ] Primary navigation is Today, Roles, Search, Candidates.
- [ ] Agent OS is absent from navigation.
- [ ] `/app/agent-os` redirects permanently to `/app/today/`.
- [ ] Candidate review links resolve to Today rather than Agent OS.
- [ ] Desktop and mobile navigation both close correctly after route changes.

## Failure paths

- [ ] Simulate a failed source request and confirm an honest error or no-result lane.
- [ ] No generated demo candidate appears.
- [ ] Simulate a source timeout and confirm Retry remains available.
- [ ] Simulate a save child-write failure and confirm the API does not return `ok: true`.
- [ ] Expire the session and confirm protected actions return an authentication response.
- [ ] Open the application in multiple tabs and repeat save; confirm one candidate identity is reused.
- [ ] Test slow network conditions and confirm streamed people remain reviewable.

## Accessibility and responsive review

- [ ] Complete Search to Drawer to Candidate 360 using keyboard only.
- [ ] Visible focus is present on every actionable control.
- [ ] Status does not rely on color alone.
- [ ] Test at 80%, 100%, 125%, and 150% zoom.
- [ ] Test at 390 px mobile width.
- [ ] No horizontal page overflow occurs.
- [ ] Candidate actions remain reachable on mobile.
- [ ] Drawer content is scrollable and the close action remains reachable.

## Console and network

- [ ] No uncaught console errors on Search, Candidates, Candidate 360, or Today.
- [ ] No repeated or runaway source requests.
- [ ] Cancelled older searches show no late state updates.
- [ ] Save requests send `entityKind: person`.
- [ ] Non-person save attempts return 422.
- [ ] No protected candidate data appears in public API responses.

## Release decision

- [ ] All P0 and P1 checks pass.
- [ ] Any failed check has a reproducible issue with severity and owner.
- [ ] Production database remains unchanged.
- [ ] No migration was applied.
- [ ] No branch was merged during QA.
- [ ] No production deployment was promoted during QA.
