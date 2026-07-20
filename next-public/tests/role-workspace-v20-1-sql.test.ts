import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const sql = readFileSync(join(process.cwd(), 'sql/role-workspace-v20-1.sql'), 'utf8').toLowerCase()

describe('V20.1 role workspace SQL contract', () => {
  it('creates the normalized role workspace tables', () => {
    expect(sql).toContain('create table if not exists public.role_workspaces')
    expect(sql).toContain('create table if not exists public.role_search_lanes')
    expect(sql).toContain('create table if not exists public.role_candidates')
    expect(sql).toContain('create table if not exists public.role_activity')
  })

  it('enables RLS on every private role table', () => {
    for (const table of ['role_workspaces', 'role_search_lanes', 'role_candidates', 'role_activity']) {
      expect(sql).toContain(`alter table public.${table} enable row level security`)
    }
    expect(sql.match(/using \(owner_id = \(select auth\.uid\(\)\)\)/g)).toHaveLength(4)
  })

  it('revokes direct authenticated writes and grants select only', () => {
    for (const table of ['role_workspaces', 'role_search_lanes', 'role_candidates', 'role_activity']) {
      expect(sql).toContain(`revoke all on public.${table} from anon, authenticated`)
      expect(sql).toContain(`grant select on public.${table} to authenticated`)
    }
    expect(sql).not.toMatch(/grant\s+(insert|update|delete|all)\s+on\s+public\.role_/)
  })

  it('requires idempotency keys for role candidates and activity', () => {
    expect(sql).toContain('unique(role_id, identity_key)')
    expect(sql).toContain('unique(role_id, event_key)')
    expect(sql).toContain('unique(role_id, lane_key)')
  })

  it('reconciles with the existing project and Candidate Graph schema', () => {
    expect(sql).toContain('legacy_project_id uuid null references public.projects(id)')
    expect(sql).toContain('candidate_id uuid null references public.candidates(id)')
    expect(sql).toContain('source_profile_id uuid null references public.source_profiles(id)')
    expect(sql).toContain('role_candidates_source_profile_idx')
  })

  it('keeps candidate fit decisions role-specific', () => {
    expect(sql).toContain("fit_decision in ('unreviewed','strong_fit','possible_fit','not_fit')")
    expect(sql).toContain('fit decisions are not global candidate ratings')
  })
})
