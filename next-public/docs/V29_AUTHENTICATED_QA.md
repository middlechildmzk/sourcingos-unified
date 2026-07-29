# V29 Authenticated QA

## Scope

Validate the role-centric sourcing loop on the V29 preview. This checklist does not authorize a production database migration or production promotion.

## Preconditions

- Use an authenticated recruiter account.
- Use a role with a title, location, at least two must-haves, and one approved search lane.
- Keep the browser console and network panel open.
- Test desktop and a mobile-width viewport.

## 1. Launch from a role

1. Open `/app/roles/{roleId}`.
2. Confirm the Role sourcing loop panel appears.
3. Select Search this role.
4. Confirm Candidate Search opens with `roleId` in the URL.
5. Return to the role.
6. Select an approved Search lane action.
7. Confirm Candidate Search opens with both `roleId` and `laneId`.
8. Confirm a proposed or paused lane is not offered as a launch action.

Expected:

- The correct role title appears in the active role context.
- Back to role returns to the exact role.
- Role review queue opens the exact role Candidates tab.
- The workbench intake is prefilled from the role.
- An approved selected lane supplies the editable must-have query draft.

## 2. Run the role-scoped search

1. Review the prefilled intake.
2. Open Search Composer.
3. Confirm the role title, location, skills, and allowed clearance breadcrumb are represented.
4. Edit the query without changing the role intake.
5. Run the search.

Expected:

- Candidate people render before diagnostics.
- Organizations, artifacts, unknown records, and search lanes remain separate.
- Clearance remains an unverified manual-safe breadcrumb.
- No synthetic candidate appears when a connector returns no result.

## 3. Save and add one person

1. Open a person result.
2. Select Save person and add to role.
3. Confirm the drawer reports a successful canonical save.
4. Confirm the role-scoped status reports that the person was added to the role review queue.
5. Open Candidate 360.
6. Confirm the Candidate 360 URL preserves `roleId`.
7. Select Back to role queue.

Expected:

- The canonical candidate ID is preserved.
- Exactly one role candidate is created.
- The role candidate enters `needs_review`.
- Fit and evidence remain unreviewed.
- One candidate-added activity is recorded.
- Candidate 360 distinguishes identity evidence from role-specific fit.

## 4. Repeat-save idempotency

1. Return to the same search and person result in a fresh page load or session.
2. Save the same person again.
3. Return to the role queue.

Expected:

- The same canonical candidate ID is returned.
- No duplicate role candidate is created.
- No duplicate candidate-added activity is created.
- The role-specific review state is preserved.

## 5. Non-person guardrail

1. Open an artifact, organization, search lane, or unknown source subject.
2. Attempt to find a save or add-to-role action.

Expected:

- No candidate save or role addition is available.
- The UI states that the source subject can be reviewed only as evidence.

## 6. Today continuation

1. Open `/app/today` after adding the unreviewed person.
2. Locate the role candidate decision.
3. Open it and complete a role-specific fit review.
4. Return to Today.

Expected:

- One actionable candidate decision appears.
- Its link opens the correct role and candidate review.
- Resolving the review changes or clears the decision deterministically.
- No outreach or stage change occurs automatically.

## 7. Accessibility and navigation

Test using keyboard only:

- Role search actions
- Candidate Search intake and composer
- Candidate result opening
- Candidate Drawer focus containment
- Escape close and focus restoration
- Candidate 360 role return
- Browser Back

Expected:

- No keyboard trap outside the intended modal trap.
- Visible focus is maintained.
- Exact role context survives forward and back navigation.

## 8. Failure paths

Test:

- Role missing from local/account storage
- Role sync temporarily unavailable
- Candidate save returns 401
- Candidate save returns a child-write error
- Network disconnected during search
- Search A immediately followed by Search B

Expected:

- Local role changes remain preserved when durable sync fails.
- Candidate save fails closed.
- Search A cannot contaminate Search B.
- No partial success is represented as a completed candidate or role addition.

## Exit criteria

V29.0 may leave draft only when:

- TypeScript passes.
- All deterministic tests pass.
- Atomic role migration contract passes.
- Production build passes.
- Vercel preview is READY.
- Desktop and mobile authenticated QA pass.
- Console and runtime log sweeps show no new errors.
- No production database mutation or migration occurred.
