-- SourcingOS V29.3A3 competing-decision serialization
--
-- Held migration companion for 20260730194500_transactional_identity_decisions.sql.
-- Serializes decisions for the same source profile before the main RPC acquires
-- proposal/profile row locks. Applying this file creates or replaces functions
-- only. It performs no identity decision, data move, merge, deletion, or backfill.

do $$
begin
  if to_regprocedure('public.decide_identity_match_proposal(uuid,uuid,text,uuid,timestamptz,timestamptz,text)') is null
     and to_regprocedure('public.decide_identity_match_proposal_unserialized(uuid,uuid,text,uuid,timestamptz,timestamptz,text)') is null then
    raise exception 'V29.3A3 serialization requires the transactional identity decision RPC';
  end if;
end $$;

-- On first application, preserve the fully tested transaction body under an
-- internal name. Replays leave the internal function intact and replace only
-- the small serialization wrapper.
do $$
begin
  if to_regprocedure('public.decide_identity_match_proposal_unserialized(uuid,uuid,text,uuid,timestamptz,timestamptz,text)') is null then
    alter function public.decide_identity_match_proposal(uuid, uuid, text, uuid, timestamptz, timestamptz, text)
      rename to decide_identity_match_proposal_unserialized;
  end if;
end $$;

revoke all on function public.decide_identity_match_proposal_unserialized(uuid, uuid, text, uuid, timestamptz, timestamptz, text)
  from PUBLIC, anon, authenticated, service_role;

create or replace function public.decide_identity_match_proposal(
  p_owner_id uuid,
  p_proposal_id uuid,
  p_action text,
  p_actor_id uuid,
  p_expected_proposal_updated_at timestamptz,
  p_expected_source_updated_at timestamptz,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_source_profile_id uuid;
begin
  -- This lookup is owner-scoped and intentionally occurs before any proposal
  -- row lock. The internal RPC repeats all authorization and stale-state checks.
  select source_profile_id into v_source_profile_id
  from public.identity_match_proposals
  where owner_id = p_owner_id and id = p_proposal_id;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'identity_proposal_not_found');
  end if;

  -- All decisions involving one source profile share this transaction-scoped
  -- lock, while unrelated profiles can still be reviewed concurrently.
  perform pg_advisory_xact_lock(hashtextextended(v_source_profile_id::text, 29303));

  return public.decide_identity_match_proposal_unserialized(
    p_owner_id,
    p_proposal_id,
    p_action,
    p_actor_id,
    p_expected_proposal_updated_at,
    p_expected_source_updated_at,
    p_reason
  );
end;
$$;

revoke all on function public.decide_identity_match_proposal(uuid, uuid, text, uuid, timestamptz, timestamptz, text)
  from PUBLIC, anon, authenticated;
grant execute on function public.decide_identity_match_proposal(uuid, uuid, text, uuid, timestamptz, timestamptz, text)
  to service_role;

comment on function public.decide_identity_match_proposal(uuid, uuid, text, uuid, timestamptz, timestamptz, text) is
  'Service-role-only serialization wrapper. Acquires one transaction advisory lock per source profile before calling the owner-scoped transactional decision body.';
comment on function public.decide_identity_match_proposal_unserialized(uuid, uuid, text, uuid, timestamptz, timestamptz, text) is
  'Internal V29.3A3 transaction body. Direct execution is revoked; use the serialized decide_identity_match_proposal wrapper.';
