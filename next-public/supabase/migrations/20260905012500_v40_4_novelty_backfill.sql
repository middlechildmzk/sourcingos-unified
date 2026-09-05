-- V40.4 novelty backfill: teach the new lane/source memory what the live V40.2
-- canaries already observed so the first V40.4 run does not waste a cycle
-- recapturing the same source-native identities.

insert into public.fleet_seen_source_profiles(
  owner_id, lane_id, source, source_profile_id,
  first_seen_at, last_seen_at, times_seen
)
select
  r.owner_id,
  l.id as lane_id,
  r.source,
  r.source_profile_id,
  min(r.discovered_at) as first_seen_at,
  max(r.discovered_at) as last_seen_at,
  count(*)::integer as times_seen
from public.fleet_raw_discoveries r
join public.fleet_standing_intents l
  on l.owner_id = r.owner_id
 and r.run_id like ('fleet_' || replace(l.id::text, '-', '') || '_%')
group by r.owner_id, l.id, r.source, r.source_profile_id
on conflict(owner_id, lane_id, source, source_profile_id) do update
  set first_seen_at = least(public.fleet_seen_source_profiles.first_seen_at, excluded.first_seen_at),
      last_seen_at = greatest(public.fleet_seen_source_profiles.last_seen_at, excluded.last_seen_at),
      times_seen = greatest(public.fleet_seen_source_profiles.times_seen, excluded.times_seen);
