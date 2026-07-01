-- SourcingOS Jobs V2 foundation
-- Hybrid job board layer for recruiter, sourcer, TA, recruiting ops, healthcare recruiting,
-- GovCon recruiting, AI recruiting, and contract recruiting roles.

create extension if not exists pgcrypto;

create table if not exists public.job_sources (
  id uuid primary key default gen_random_uuid(),
  source_type text not null,
  label text not null,
  url text,
  enabled boolean not null default true,
  crawl_cadence text not null default 'manual',
  terms_notes text,
  last_checked_at timestamptz,
  status text not null default 'active' check (status in ('active', 'inactive', 'needs_review', 'error')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists job_sources_type_url_idx
  on public.job_sources (source_type, coalesce(url, ''));

create table if not exists public.job_postings (
  id uuid primary key default gen_random_uuid(),
  source_type text not null,
  source_id text,
  source_url text,
  apply_url text not null,
  title text not null,
  normalized_title text,
  company text not null,
  normalized_company text,
  location text,
  remote_type text,
  employment_type text,
  salary_min integer,
  salary_max integer,
  salary_text text,
  posted_at timestamptz,
  expires_at timestamptz,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  description_snippet text,
  tags text[] not null default '{}',
  category text,
  relevance_score integer not null default 0,
  status text not null default 'active' check (status in ('active', 'inactive', 'pending_review', 'rejected', 'expired')),
  dedupe_key text,
  raw jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists job_postings_source_unique_idx
  on public.job_postings (source_type, source_id)
  where source_id is not null;

create unique index if not exists job_postings_dedupe_key_idx
  on public.job_postings (dedupe_key)
  where dedupe_key is not null;

create index if not exists job_postings_status_seen_idx
  on public.job_postings (status, last_seen_at desc);

create index if not exists job_postings_category_idx
  on public.job_postings (category);

create table if not exists public.job_submissions (
  id uuid primary key default gen_random_uuid(),
  employer_name text,
  contact_email text,
  title text,
  company text,
  apply_url text,
  salary_text text,
  location text,
  description text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reviewed_by text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Legacy/public form columns kept for current route compatibility.
  email text,
  company_name text,
  job_title text,
  job_url text,
  salary_range text,
  remote_type text,
  notes text,
  submitted_at timestamptz not null default now()
);

alter table public.job_submissions add column if not exists employer_name text;
alter table public.job_submissions add column if not exists contact_email text;
alter table public.job_submissions add column if not exists title text;
alter table public.job_submissions add column if not exists company text;
alter table public.job_submissions add column if not exists apply_url text;
alter table public.job_submissions add column if not exists salary_text text;
alter table public.job_submissions add column if not exists description text;
alter table public.job_submissions add column if not exists reviewed_by text;
alter table public.job_submissions add column if not exists reviewed_at timestamptz;
alter table public.job_submissions add column if not exists created_at timestamptz not null default now();
alter table public.job_submissions add column if not exists updated_at timestamptz not null default now();
alter table public.job_submissions add column if not exists submitted_at timestamptz not null default now();

create table if not exists public.job_alert_signups (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  query text,
  location text,
  category text,
  frequency text not null default 'weekly' check (frequency in ('daily', 'weekly')),
  consent_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists job_alert_signups_email_idx
  on public.job_alert_signups (lower(email));

alter table public.job_sources enable row level security;
alter table public.job_postings enable row level security;
alter table public.job_submissions enable row level security;
alter table public.job_alert_signups enable row level security;
