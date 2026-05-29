-- ══════════════════════════════════════════════════════════════════════════════
-- SourcingOS V19 — Row Level Security policies
-- Run AFTER complete-schema-v19.sql
-- Audit this file before every deploy. Every table must have explicit policies.
-- ══════════════════════════════════════════════════════════════════════════════

-- ── Enable RLS on every table ─────────────────────────────────────────────────
alter table public.profiles                enable row level security;
alter table public.projects                enable row level security;
alter table public.candidates              enable row level security;
alter table public.project_candidates      enable row level security;
alter table public.pipeline_entries        enable row level security;
alter table public.source_profiles         enable row level security;
alter table public.evidence_items          enable row level security;
alter table public.candidate_contacts      enable row level security;
alter table public.open_to_work_signals    enable row level security;
alter table public.identity_match_reviews  enable row level security;
alter table public.candidate_refresh_events enable row level security;
alter table public.candidate_import_batches enable row level security;
alter table public.job_submissions         enable row level security;
alter table public.approved_jobs           enable row level security;
alter table public.waitlist                enable row level security;

-- ── Helper: is caller an admin? ───────────────────────────────────────────────
-- Used inline in policy USING clauses. Avoids function call overhead in hot paths.
-- Pattern: exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')

-- ── profiles ──────────────────────────────────────────────────────────────────
create policy "profiles_own_read_write" on public.profiles
  for all using (auth.uid() = id);

create policy "profiles_admin_read" on public.profiles
  for select using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

-- ── projects: owner only ──────────────────────────────────────────────────────
create policy "projects_owner" on public.projects
  for all using (auth.uid() = owner_id);

-- ── candidates: owner only (global identity, not public) ──────────────────────
create policy "candidates_owner" on public.candidates
  for all using (auth.uid() = owner_id);

-- ── project_candidates: owner only ───────────────────────────────────────────
create policy "project_candidates_owner" on public.project_candidates
  for all using (auth.uid() = owner_id);

-- ── pipeline_entries: owner only ─────────────────────────────────────────────
create policy "pipeline_entries_owner" on public.pipeline_entries
  for all using (auth.uid() = owner_id);

-- ── source_profiles: owner only ──────────────────────────────────────────────
create policy "source_profiles_owner" on public.source_profiles
  for all using (auth.uid() = owner_id);

-- ── evidence_items: owner only ───────────────────────────────────────────────
create policy "evidence_items_owner" on public.evidence_items
  for all using (auth.uid() = owner_id);

-- ── candidate_contacts: owner only — NEVER public ────────────────────────────
-- Contact data is private. No public policy. No admin cross-read.
create policy "candidate_contacts_owner" on public.candidate_contacts
  for all using (auth.uid() = owner_id);

-- ── open_to_work_signals: owner only ─────────────────────────────────────────
create policy "open_to_work_signals_owner" on public.open_to_work_signals
  for all using (auth.uid() = owner_id);

-- ── identity_match_reviews: owner only ───────────────────────────────────────
create policy "identity_match_reviews_owner" on public.identity_match_reviews
  for all using (auth.uid() = owner_id);

-- ── candidate_refresh_events: owner only ─────────────────────────────────────
create policy "candidate_refresh_events_owner" on public.candidate_refresh_events
  for all using (auth.uid() = owner_id);

-- ── candidate_import_batches: owner only ─────────────────────────────────────
create policy "candidate_import_batches_owner" on public.candidate_import_batches
  for all using (auth.uid() = owner_id);

-- ── job_submissions: admins only ──────────────────────────────────────────────
-- Submitters cannot see the queue. Employers submit via /jobs/submit (server-side write).
create policy "job_submissions_admin_all" on public.job_submissions
  for all using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

-- ── approved_jobs: public read, admin write ───────────────────────────────────
create policy "approved_jobs_public_read" on public.approved_jobs
  for select using (is_active = true);

create policy "approved_jobs_admin_write" on public.approved_jobs
  for all using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

-- ── waitlist: anonymous insert, admin read ────────────────────────────────────
-- unauthenticated users can add themselves; only admins can see the list
create policy "waitlist_anon_insert" on public.waitlist
  for insert with check (true);   -- public insert; email unique constraint prevents spam

create policy "waitlist_admin_read" on public.waitlist
  for select using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );
