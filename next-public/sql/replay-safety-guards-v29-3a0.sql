-- SourcingOS V29.3A0.1 — reconstruction replay guard prelude
--
-- This file is for disposable reconstruction and CI replay only.
-- It is NOT a production migration and must never be applied to a linked
-- production project. Historical SQL remains immutable; this prelude removes
-- only the named triggers and RLS policies that those historical files recreate.
--
-- Required state: the reconstructed eight-file production sequence has already
-- been applied once, so every referenced table exists.

-- V19 triggers recreated by complete-schema-v19.sql.
drop trigger if exists set_updated_at_profiles on public.profiles;
drop trigger if exists on_auth_user_created on auth.users;
drop trigger if exists set_updated_at_projects on public.projects;
drop trigger if exists set_updated_at_candidates on public.candidates;
drop trigger if exists set_updated_at_project_candidates on public.project_candidates;
drop trigger if exists set_updated_at_pipeline_entries on public.pipeline_entries;
drop trigger if exists set_updated_at_source_profiles on public.source_profiles;

-- V19 policies recreated by rls-policies-v19.sql.
drop policy if exists "profiles_own_read_write" on public.profiles;
drop policy if exists "profiles_admin_read" on public.profiles;
drop policy if exists "projects_owner" on public.projects;
drop policy if exists "candidates_owner" on public.candidates;
drop policy if exists "project_candidates_owner" on public.project_candidates;
drop policy if exists "pipeline_entries_owner" on public.pipeline_entries;
drop policy if exists "source_profiles_owner" on public.source_profiles;
drop policy if exists "evidence_items_owner" on public.evidence_items;
drop policy if exists "candidate_contacts_owner" on public.candidate_contacts;
drop policy if exists "open_to_work_signals_owner" on public.open_to_work_signals;
drop policy if exists "identity_match_reviews_owner" on public.identity_match_reviews;
drop policy if exists "candidate_refresh_events_owner" on public.candidate_refresh_events;
drop policy if exists "candidate_import_batches_owner" on public.candidate_import_batches;
drop policy if exists "job_submissions_admin_all" on public.job_submissions;
drop policy if exists "approved_jobs_public_read" on public.approved_jobs;
drop policy if exists "approved_jobs_admin_write" on public.approved_jobs;
drop policy if exists "waitlist_anon_insert" on public.waitlist;
drop policy if exists "waitlist_admin_read" on public.waitlist;

-- V21 policies recreated by candidate-acquisition-v21.sql.
drop policy if exists candidate_source_registry_owner_select on public.candidate_source_registry;
drop policy if exists candidate_enrichment_queue_owner_select on public.candidate_enrichment_queue;
drop policy if exists candidate_growth_targets_owner_select on public.candidate_growth_targets;

-- V22 policies recreated by autosource-v22.sql.
drop policy if exists acquisition_campaigns_owner_select on public.acquisition_campaigns;
drop policy if exists acquisition_runs_owner_select on public.acquisition_runs;
drop policy if exists acquisition_discoveries_owner_select on public.acquisition_discoveries;
drop policy if exists acquisition_source_cursors_owner_select on public.acquisition_source_cursors;
drop policy if exists candidate_quality_owner_select on public.candidate_quality_snapshots;
drop policy if exists autosource_inbox_owner_select on public.autosource_inbox;

-- V23-V25 policies recreated by agent-os-v23-v25.sql.
drop policy if exists agent_workflows_owner_select on public.agent_workflows;
drop policy if exists agent_steps_owner_select on public.agent_steps;
drop policy if exists agent_approvals_owner_select on public.agent_approvals;
drop policy if exists recruiter_memory_owner_select on public.recruiter_memory_signals;
drop policy if exists talent_graph_owner_select on public.talent_graph_edges;
drop policy if exists recruiter_briefs_owner_select on public.recruiter_daily_briefs;
