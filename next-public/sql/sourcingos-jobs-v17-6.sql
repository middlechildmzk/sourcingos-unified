-- SourcingOS Jobs V17.6
-- Curated link-out job board schema.
-- Store metadata and short snippets only. Do not store full third-party job descriptions unless explicitly permitted.

create table if not exists public.sourcingos_jobs (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  company_name text not null,
  company_logo_url text,
  location text,
  remote_type text,
  employment_type text,
  category text not null,
  subcategory text[] default '{}',
  salary_range text default 'Not listed',
  salary_min integer,
  salary_max integer,
  salary_currency text default 'USD',
  description_snippet text,
  source_url text not null,
  apply_url text not null,
  source_type text not null check (source_type in ('employer-submission','greenhouse','lever','ashby','usajobs','remotive','arbeitnow','manual-curation')),
  source_id text,
  status text not null default 'pending' check (status in ('pending','approved','rejected','expired')),
  posted_at timestamptz,
  expires_at timestamptz,
  last_checked_at timestamptz default now(),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint unique_job_source unique (source_type, source_id)
);

create index if not exists idx_sourcingos_jobs_status_category on public.sourcingos_jobs(status, category);
create index if not exists idx_sourcingos_jobs_source_type on public.sourcingos_jobs(source_type);
create index if not exists idx_sourcingos_jobs_last_checked on public.sourcingos_jobs(last_checked_at desc);

create table if not exists public.sourcingos_job_submissions (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  company_name text not null,
  job_title text not null,
  job_url text not null,
  notes text,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  submitted_at timestamptz default now(),
  reviewed_at timestamptz
);

create table if not exists public.sourcingos_ats_targets (
  id uuid primary key default gen_random_uuid(),
  company_name text not null,
  ats_type text not null check (ats_type in ('greenhouse','lever','ashby')),
  board_token text not null,
  categories text[] default '{}',
  is_active boolean default true,
  last_synced_at timestamptz,
  created_at timestamptz default now(),
  constraint unique_ats_target unique (ats_type, board_token)
);

create table if not exists public.sourcingos_job_ingestion_runs (
  id uuid primary key default gen_random_uuid(),
  source_type text not null,
  source_ref text,
  status text not null check (status in ('started','completed','failed')),
  jobs_seen integer default 0,
  jobs_upserted integer default 0,
  error_message text,
  started_at timestamptz default now(),
  completed_at timestamptz
);
