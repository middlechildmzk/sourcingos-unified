-- Shared server-side rate-limit fallback for SourcingOS.
-- Upstash Redis remains the preferred first backend. This table/function
-- provides a cross-instance fallback so public APIs are not protected only by
-- per-serverless-instance memory when Redis is absent or temporarily unavailable.

create table if not exists public.rate_limit_counters (
  key text primary key,
  count integer not null default 0 check (count >= 0),
  expires_at timestamptz not null,
  updated_at timestamptz not null default now()
);

alter table public.rate_limit_counters enable row level security;
revoke all on table public.rate_limit_counters from anon, authenticated;
grant select, insert, update, delete on table public.rate_limit_counters to service_role;

create or replace function public.consume_rate_limit(counter_key text, window_seconds integer)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  now_ts timestamptz := clock_timestamp();
  new_count integer;
begin
  if counter_key is null or char_length(counter_key) < 1 or char_length(counter_key) > 300 then
    raise exception 'invalid counter key';
  end if;

  if window_seconds < 1 or window_seconds > 86400 then
    raise exception 'invalid rate limit window';
  end if;

  insert into public.rate_limit_counters as counters (key, count, expires_at, updated_at)
  values (counter_key, 1, now_ts + make_interval(secs => window_seconds), now_ts)
  on conflict (key) do update
    set count = case
          when counters.expires_at <= now_ts then 1
          else counters.count + 1
        end,
        expires_at = case
          when counters.expires_at <= now_ts then now_ts + make_interval(secs => window_seconds)
          else counters.expires_at
        end,
        updated_at = now_ts
  returning count into new_count;

  return new_count;
end;
$$;

revoke all on function public.consume_rate_limit(text, integer) from public, anon, authenticated;
grant execute on function public.consume_rate_limit(text, integer) to service_role;

comment on table public.rate_limit_counters is
  'Shared server-side rate-limit counters used as a fallback when Upstash Redis is unavailable.';
comment on function public.consume_rate_limit(text, integer) is
  'Atomically increments or resets one shared rate-limit counter. Service-role only.';
