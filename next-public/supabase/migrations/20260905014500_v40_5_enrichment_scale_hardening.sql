-- V40.5 enrichment scale hardening.
-- These indexes cover foreign-key delete/update paths that become important as
-- the enrichment graph grows, and the RLS predicates use one init-plan auth
-- lookup rather than re-evaluating auth.uid() per row.

create index if not exists candidate_enrichment_tasks_candidate_id_idx
  on public.candidate_enrichment_tasks(candidate_id);
create index if not exists candidate_profile_facts_candidate_id_idx
  on public.candidate_profile_facts(candidate_id);
create index if not exists candidate_profile_facts_source_profile_id_idx
  on public.candidate_profile_facts(source_profile_id)
  where source_profile_id is not null;
create index if not exists candidate_profile_facts_artifact_id_idx
  on public.candidate_profile_facts(artifact_id)
  where artifact_id is not null;
create index if not exists public_document_leads_candidate_id_idx
  on public.public_document_leads(candidate_id);
create index if not exists public_document_leads_artifact_id_idx
  on public.public_document_leads(artifact_id)
  where artifact_id is not null;
create index if not exists fleet_source_cursors_lane_id_idx
  on public.fleet_source_cursors(lane_id);
create index if not exists fleet_seen_source_profiles_lane_id_idx
  on public.fleet_seen_source_profiles(lane_id);

drop policy if exists candidate_enrichment_tasks_select_own on public.candidate_enrichment_tasks;
create policy candidate_enrichment_tasks_select_own on public.candidate_enrichment_tasks
  for select to authenticated
  using (owner_id = (select auth.uid()));

drop policy if exists candidate_profile_facts_select_own on public.candidate_profile_facts;
create policy candidate_profile_facts_select_own on public.candidate_profile_facts
  for select to authenticated
  using (owner_id = (select auth.uid()));

drop policy if exists public_document_leads_select_own on public.public_document_leads;
create policy public_document_leads_select_own on public.public_document_leads
  for select to authenticated
  using (owner_id = (select auth.uid()));
