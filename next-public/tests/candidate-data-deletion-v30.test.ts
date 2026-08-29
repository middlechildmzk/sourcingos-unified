import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(
  fileURLToPath(new URL('../supabase/migrations/20260829160000_candidate_bundle_delete.sql', import.meta.url)),
  'utf8',
).toLowerCase()
const route = readFileSync(
  fileURLToPath(new URL('../app/api/candidate-db/delete/[id]/route.ts', import.meta.url)),
  'utf8',
)
const localPurge = readFileSync(
  fileURLToPath(new URL('../lib/candidate-local-purge.ts', import.meta.url)),
  'utf8',
)

describe('V30 candidate data deletion governance', () => {
  it('keeps the hard-delete RPC service-role only and owner scoped', () => {
    expect(migration).toContain('security definer')
    expect(migration).toContain('where id = p_candidate_id')
    expect(migration).toContain('and owner_id = p_owner_id')
    expect(migration).toContain('revoke all on function public.delete_candidate_bundle(uuid, uuid) from public, anon, authenticated')
    expect(migration).toContain('grant execute on function public.delete_candidate_bundle(uuid, uuid) to service_role')
  })

  it('removes known personal/provenance shadows rather than only the canonical row', () => {
    for (const table of [
      'public.acquisition_discoveries',
      'public.identity_match_reviews',
      'public.role_candidates',
      'public.recruiter_memory_signals',
      'public.role_activity',
      'public.agent_workflows',
      'public.talent_graph_edges',
      'public.source_profiles',
      'public.candidates',
    ]) {
      expect(migration).toContain(`delete from ${table}`)
    }
    expect(migration).toContain("set calibration = '{}'::jsonb")
  })

  it('authenticates and rate limits before invoking deletion', () => {
    const authIndex = route.indexOf('requireSession()')
    const rateIndex = route.indexOf("rateLimit(req, 'workbench'")
    const rpcIndex = route.indexOf("rpc('delete_candidate_bundle'")
    expect(authIndex).toBeGreaterThan(-1)
    expect(rateIndex).toBeGreaterThan(authIndex)
    expect(rpcIndex).toBeGreaterThan(rateIndex)
    expect(route).toContain('gate.userId')
    expect(route).toContain('gate.preview')
  })

  it('purges local-first role state so browser storage cannot keep a deleted candidate active', () => {
    expect(localPurge).toContain('candidate.candidateId !== candidateId')
    expect(localPurge).toContain('role.calibration = undefined')
    expect(localPurge).toContain('writeRoleWorkspaces(roles)')
  })
})
