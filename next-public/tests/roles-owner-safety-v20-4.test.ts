import { beforeEach, describe, expect, it, vi } from 'vitest'

const ROLE_ID = '11111111-1111-4111-8111-111111111111'
const CANDIDATE_ID = '22222222-2222-4222-8222-222222222222'

const state = vi.hoisted(() => ({
  rpcData: {
    ok: true,
    version: 2,
    updatedAt: '2026-07-21T18:00:00.000Z',
    counts: { lanes: 1, candidates: 1, activity: 1 },
  } as Record<string, unknown> | null,
  rpcError: null as null | { code?: string; message: string },
  rpcCalls: [] as Array<{ name: string; args: Record<string, unknown> }>,
  fromCalls: [] as string[],
  deleteData: { id: '11111111-1111-4111-8111-111111111111' } as { id: string } | null,
  deleteError: null as null | { message: string },
  versionFilters: [] as unknown[],
}))

vi.mock('@/lib/auth-gate', () => ({
  requireSession: async () => ({ ok: true, userId: 'user-A', isAdmin: false, preview: false }),
}))
vi.mock('@/lib/rate-limit', () => ({ rateLimit: async () => ({ ok: true }) }))
vi.mock('@/lib/supabase/server', () => ({
  isDurablePersistenceConfigured: () => true,
  createServerSupabaseClient: () => ({
    rpc: async (name: string, args: Record<string, unknown>) => {
      state.rpcCalls.push({ name, args })
      return { data: state.rpcData, error: state.rpcError }
    },
    from: (table: string) => {
      state.fromCalls.push(table)
      const builder: any = {
        delete: () => builder,
        eq: (column: string, value: unknown) => {
          if (column === 'version') state.versionFilters.push(value)
          return builder
        },
        select: () => builder,
        maybeSingle: async () => ({ data: state.deleteData, error: state.deleteError }),
      }
      return builder
    },
  }),
}))

import { DELETE, POST } from '@/app/api/roles/sync/route'

function workspace(expectedVersion?: number) {
  return {
    workspace: {
      id: ROLE_ID,
      status: 'active',
      intake: {
        title: ' Senior Sourcer ',
        location: ' Minneapolis ',
        workMode: 'remote',
        mustHaves: ['Sourcing', 'Sourcing'],
      },
      searchLanes: [
        { id: 'lane-1', label: ' Core ', purpose: '', query: 'sourcer', source: 'candidate_graph', status: 'approved' },
        { id: 'lane-1', label: ' Core ', purpose: '', query: 'sourcer', source: 'candidate_graph', status: 'approved' },
      ],
      candidates: [
        {
          id: CANDIDATE_ID,
          name: 'Candidate One',
          headline: 'Recruiter',
          company: 'Example',
          location: 'Minnesota',
          source: 'manual',
          stage: 'needs_review',
          fitDecision: 'unreviewed',
          fitReasons: [],
          concerns: [],
          tags: [],
          contactStatus: 'unknown',
          evidenceStatus: 'unreviewed',
          addedAt: '2026-07-21T17:00:00.000Z',
          updatedAt: 'not-a-date',
        },
      ],
      activity: [
        {
          id: 'event-1',
          type: 'role_updated',
          message: 'Role updated',
          createdAt: '2026-07-21T17:30:00.000Z',
        },
      ],
    },
    expectedVersion,
  }
}

function request(body: unknown) {
  return {
    json: async () => body,
    headers: new Headers(),
    url: 'http://localhost/api/roles/sync',
  } as any
}

function deleteRequest(expectedVersion = 1) {
  return {
    headers: new Headers(),
    url: `http://localhost/api/roles/sync?roleId=${ROLE_ID}&expectedVersion=${expectedVersion}`,
  } as any
}

beforeEach(() => {
  state.rpcData = {
    ok: true,
    version: 2,
    updatedAt: '2026-07-21T18:00:00.000Z',
    counts: { lanes: 1, candidates: 1, activity: 1 },
  }
  state.rpcError = null
  state.rpcCalls = []
  state.fromCalls = []
  state.deleteData = { id: ROLE_ID }
  state.deleteError = null
  state.versionFilters = []
})

describe('POST /api/roles/sync atomic snapshot safety', () => {
  it('rejects invalid workspaces before calling the database', async () => {
    const response = await POST(request({ workspace: { id: 'bad' } }))
    expect(response.status).toBe(400)
    expect(state.rpcCalls).toHaveLength(0)
    expect(state.fromCalls).toHaveLength(0)
  })

  it('delegates one sanitized, deduplicated snapshot to the server-only RPC', async () => {
    state.rpcData = {
      ok: true,
      version: 5,
      updatedAt: '2026-07-21T18:00:00.000Z',
      counts: { lanes: 1, candidates: 1, activity: 1 },
    }

    const response = await POST(request(workspace(4)))
    expect(response.status).toBe(200)
    expect(state.rpcCalls).toHaveLength(1)
    expect(state.fromCalls).toHaveLength(0)

    const call = state.rpcCalls[0]
    expect(call.name).toBe('save_role_workspace_snapshot')
    expect(call.args).toMatchObject({
      p_owner_id: 'user-A',
      p_role_id: ROLE_ID,
      p_expected_version: 4,
      p_role: {
        title: 'Senior Sourcer',
        location: 'Minneapolis',
        work_mode: 'remote',
      },
    })
    expect(call.args.p_lanes).toHaveLength(1)
    expect(call.args.p_candidates).toHaveLength(1)
    expect(call.args.p_activity).toHaveLength(1)
    expect((call.args.p_candidates as Array<Record<string, unknown>>)[0].updated_at).toEqual(expect.stringMatching(/Z$/))
    expect((await response.json()).version).toBe(5)
  })

  it('maps cross-owner rejection from the transaction to 403', async () => {
    state.rpcData = {
      ok: false,
      status: 403,
      code: 'role_owned_by_another',
      error: 'This role belongs to another account.',
    }

    const response = await POST(request(workspace(1)))
    expect(response.status).toBe(403)
    expect((await response.json()).code).toBe('role_owned_by_another')
  })

  it('maps stale-version rejection and preserves the current version', async () => {
    state.rpcData = {
      ok: false,
      status: 409,
      code: 'role_version_conflict',
      error: 'This role changed in another session. Refresh before saving.',
      currentVersion: 7,
    }

    const response = await POST(request(workspace(6)))
    expect(response.status).toBe(409)
    expect(await response.json()).toMatchObject({
      code: 'role_version_conflict',
      currentVersion: 7,
    })
  })

  it('fails closed when the atomic migration is not available', async () => {
    state.rpcData = null
    state.rpcError = { code: 'PGRST202', message: 'Could not find the function public.save_role_workspace_snapshot' }

    const response = await POST(request(workspace(1)))
    expect(response.status).toBe(503)
    expect((await response.json()).code).toBe('role_snapshot_migration_required')
    expect(state.fromCalls).toHaveLength(0)
  })

  it('returns 500 for unexpected RPC failures without starting direct writes', async () => {
    state.rpcData = null
    state.rpcError = { message: 'database unavailable' }

    const response = await POST(request(workspace(1)))
    expect(response.status).toBe(500)
    expect(state.fromCalls).toHaveLength(0)
  })
})

describe('DELETE /api/roles/sync', () => {
  it('deletes only the authenticated owner’s expected role version', async () => {
    const response = await DELETE(deleteRequest(4))
    expect(response.status).toBe(200)
    expect(state.fromCalls).toEqual(['role_workspaces'])
    expect(state.versionFilters).toContain(4)
    expect((await response.json()).persisted).toBe(true)
  })

  it('returns 409 when the role changed or is unavailable', async () => {
    state.deleteData = null
    const response = await DELETE(deleteRequest())
    expect(response.status).toBe(409)
    expect((await response.json()).code).toBe('role_delete_conflict')
  })

  it('requires a valid version', async () => {
    const response = await DELETE({ headers: new Headers(), url: `http://localhost/api/roles/sync?roleId=${ROLE_ID}` } as any)
    expect(response.status).toBe(400)
  })
})
