-- SourcingOS recruiter-job alert signup storage.
-- Server-only writes. This captures alert intent; delivery is intentionally
-- described in-product as upcoming until the email sender is implemented.

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

create index if not exists job_alert_signups_category_created_at_idx
  on public.job_alert_signups (category, created_at desc);

create index if not exists job_alert_signups_email_idx
  on public.job_alert_signups (lower(email));

alter table public.job_alert_signups enable row level security;

revoke all on table public.job_alert_signups from anon, authenticated;
grant select, insert, delete on table public.job_alert_signups to service_role;

comment on table public.job_alert_signups is
  'Opt-in recruiter job alert interest captured by SourcingOS. Server-only; no public Data API access.';
