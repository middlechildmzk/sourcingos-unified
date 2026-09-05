-- SourcingOS V20.3 — Existing-schema security and performance hardening
-- Reviewed against active project dtkbddsjcovtesajmdix on 2026-07-20.
-- Keep separate from the additive role migration so rollout and rollback stay isolated.

-- Trigger helpers must not resolve attacker-controlled objects through a mutable search_path.
alter function public.set_updated_at() set search_path = public, pg_temp;
alter function public.handle_new_user() set search_path = public, auth, pg_temp;

-- handle_new_user is an auth trigger helper, not a public RPC endpoint.
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- Cover foreign keys used by Candidate Graph and project workflows.
create index if not exists approved_jobs_submission_id_idx on public.approved_jobs(submission_id);
create index if not exists candidate_contacts_candidate_id_idx on public.candidate_contacts(candidate_id);
create index if not exists candidate_contacts_owner_id_idx on public.candidate_contacts(owner_id);
create index if not exists candidate_contacts_source_profile_id_idx on public.candidate_contacts(source_profile_id);
create index if not exists candidate_import_batches_owner_id_idx on public.candidate_import_batches(owner_id);
create index if not exists candidate_refresh_events_candidate_id_idx on public.candidate_refresh_events(candidate_id);
create index if not exists candidate_refresh_events_owner_id_idx on public.candidate_refresh_events(owner_id);
create index if not exists candidates_owner_id_idx on public.candidates(owner_id);
create index if not exists evidence_items_candidate_id_idx on public.evidence_items(candidate_id);
create index if not exists evidence_items_owner_id_idx on public.evidence_items(owner_id);
create index if not exists evidence_items_source_profile_id_idx on public.evidence_items(source_profile_id);
create index if not exists identity_match_reviews_candidate_id_idx on public.identity_match_reviews(candidate_id);
create index if not exists identity_match_reviews_owner_id_idx on public.identity_match_reviews(owner_id);
create index if not exists job_submissions_reviewed_by_idx on public.job_submissions(reviewed_by);
create index if not exists open_to_work_signals_candidate_id_idx on public.open_to_work_signals(candidate_id);
create index if not exists open_to_work_signals_owner_id_idx on public.open_to_work_signals(owner_id);
create index if not exists open_to_work_signals_source_profile_id_idx on public.open_to_work_signals(source_profile_id);
create index if not exists pipeline_entries_candidate_id_idx on public.pipeline_entries(candidate_id);
create index if not exists pipeline_entries_owner_id_idx on public.pipeline_entries(owner_id);
create index if not exists pipeline_entries_project_id_idx on public.pipeline_entries(project_id);
create index if not exists project_candidates_added_by_idx on public.project_candidates(added_by);
create index if not exists project_candidates_candidate_id_idx on public.project_candidates(candidate_id);
create index if not exists project_candidates_owner_id_idx on public.project_candidates(owner_id);
create index if not exists projects_owner_id_idx on public.projects(owner_id);
create index if not exists source_profiles_candidate_id_idx on public.source_profiles(candidate_id);

-- RLS policy rewrites and broad privilege reductions are intentionally deferred until
-- every direct Data API call is inventoried. Existing RLS remains enabled meanwhile.
