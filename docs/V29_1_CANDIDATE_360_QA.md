# V29.1 Role-Specific Candidate 360 QA

This checklist validates the recruiter-facing Candidate 360 review added in V29.1.

## Preview gate

- The preview must be built from the V29.1 branch after the pull request targets `main`.
- Confirm the deployment is READY and its runtime SHA matches the executable branch head being reviewed.
- Run an error, warning, and fatal runtime-log sweep before approval.

## Preconditions

- Use an authenticated test account.
- Create or open a role with at least three must-have requirements and one nice-to-have.
- Add one canonical person to the role through the V29.0 role-scoped search flow.
- Open Candidate 360 with the originating `roleId` preserved.

## Role context and hierarchy

1. Confirm the role-specific review appears before generic Candidate 360 evidence.
2. Confirm the role title is correct.
3. Confirm **Back to role queue** returns to the exact role and candidate tab.
4. Confirm **Role calibration** returns to the same role and calibration tab.
5. Confirm a candidate not linked to the selected role receives a clear fail-closed message rather than editable review controls.

## Requirement coverage

1. Confirm must-have and nice-to-have requirements are divided into **Supported** and **Unconfirmed**.
2. Confirm support is based only on role-review tags and recorded fit rationale.
3. Confirm no percentage, fit score, or independent-verification claim is shown.
4. Add a fit rationale containing an unconfirmed requirement and confirm coverage updates.
5. Confirm the rationale is labelled recruiter-authored review context, not verified evidence.
6. Confirm an unrelated word containing a requirement substring does not count as coverage, such as `draws` for `AWS`.

## Fit decisions

1. Select **Strong fit**.
2. Confirm the displayed fit decision changes.
3. Confirm the pipeline stage does not change.
4. Select **Strong fit** again and confirm no duplicate activity is created.
5. Repeat with **Possible fit**, **Not fit**, and **Reset decision**.
6. Confirm none of these actions sends outreach, verifies identity, or changes contact state.

## Pipeline stage

1. Choose a different stage from the stage selector.
2. Confirm the **Update stage** button becomes available.
3. Confirm the stage changes only after pressing **Update stage**.
4. Confirm the fit decision remains unchanged.
5. Confirm no outreach is triggered.
6. Select the current stage and confirm no duplicate activity is created.

## Recruiter review context

1. Add a fit rationale between 3 and 300 characters.
2. Confirm it appears under **Recorded fit rationale**.
3. Confirm the fit decision and pipeline stage remain unchanged.
4. Add a concern and confirm it appears under **Recorded concerns**.
5. Attempt to add the same note with different casing and surrounding whitespace.
6. Confirm the duplicate is rejected and no duplicate activity is created.
7. Confirm text shorter than 3 characters cannot be submitted.
8. Confirm text cannot exceed 300 characters.

## Verify-next behavior

1. Confirm missing must-haves appear in Verify next.
2. Confirm unreviewed, conflicting, or stale evidence creates the appropriate verification task.
3. Confirm contact signals remain unverified and require permission review.
4. Confirm clearance language remains a verification breadcrumb only.
5. Confirm recorded concerns create a follow-up task.

## Candidate dossier integrity

1. Load a complete Candidate 360 dossier and verify evidence, source profiles, contacts, availability signals, and identity reviews render.
2. Confirm no synthetic evidence score is displayed or returned by the Supabase dossier path.
3. Simulate or inspect a failed related-table request.
4. Confirm Candidate 360 fails closed with the failed section identified rather than silently showing an incomplete dossier.

## Accessibility and responsive behavior

1. Complete fit decisions using keyboard only.
2. Complete a stage change using keyboard only.
3. Add a review note using keyboard only.
4. Confirm focus indicators are visible.
5. Confirm status changes are announced through `role="status"` regions.
6. Repeat the full review at mobile width.
7. Confirm controls do not overflow, overlap, or become unreachable.

## Release boundaries

- No production database migration is part of V29.1.
- No automatic fit decision is allowed.
- No automatic stage advancement is allowed.
- No outreach is triggered by review actions.
- Recruiter-authored rationale and concerns are not verified evidence.
- Identity, clearance, contact, and availability remain separately verified concepts.
