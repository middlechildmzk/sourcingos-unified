-- Dedicated privacy, security, candidate-data, and product contact channel.
-- Public clients never access this table directly; writes occur through the
-- rate-limited /api/contact server route using the service role.

create table if not exists public.contact_requests (
  id uuid primary key default gen_random_uuid(),
  category text not null check (category in ('privacy', 'security', 'candidate_data', 'general')),
  email text not null check (char_length(email) between 3 and 320),
  subject text check (subject is null or char_length(subject) <= 160),
  candidate_reference text check (candidate_reference is null or char_length(candidate_reference) <= 500),
  message text not null check (char_length(message) between 10 and 5000),
  status text not null default 'new' check (status in ('new', 'reviewing', 'resolved', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.contact_requests is
  'Server-only privacy, security, candidate-data removal, and product contact requests. No public Data API access.';

alter table public.contact_requests enable row level security;
revoke all on table public.contact_requests from anon, authenticated;
