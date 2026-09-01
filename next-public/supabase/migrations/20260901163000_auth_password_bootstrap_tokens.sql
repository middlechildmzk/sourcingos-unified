-- Server-only, single-use password bootstrap tokens for pre-approved beta users.
-- Plaintext setup codes are never stored. The public API exposes no RLS policy
-- for this table; only the service-role server path can read or consume rows.

create table if not exists public.auth_password_bootstrap_tokens (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  token_hash text not null,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.auth_password_bootstrap_tokens enable row level security;
revoke all on table public.auth_password_bootstrap_tokens from anon, authenticated;
grant all on table public.auth_password_bootstrap_tokens to service_role;

comment on table public.auth_password_bootstrap_tokens is
  'Server-only, single-use password bootstrap tokens for pre-approved beta users. Plaintext tokens are never stored.';
