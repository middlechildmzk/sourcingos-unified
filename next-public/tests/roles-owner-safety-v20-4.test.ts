import { beforeEach, describe, expect, it, vi } from 'vitest'

const ROLE_ID = '11111111-1111-4111-8111-111111111111'

const state = vi.hoisted(() => ({
  existingOwner: 'user-B' as string | null,
  existingVersion: 1,
  insertError: null as null | { code?: string; message: string },
  updateData: { id: '11111111-1111-4111-8111-111111111111' } as { id: string } | null,
  updateError: null as null | { message: string },
  deleteData: { id: '11111111-1111-4111-8111-111111111111' } as { id: string } | null,
  deleteError: null as null | { message: string },
  insertPayload: null as Record<string, unknown> | null,
  updatePayload: null as Record<string, unknown> | null,
  versionFilters: [] as unknown[],
  childWrites: 0,
}))

vi.mock('@/lib/auth-gate', () => ({
  requireSession: async () => ({ ok: true, userId: 'user-A', isAdmin: false, preview: false }),
}))
vi.mock('@/lib/rate-limit', () => ({ rateLimit: async () => ({ ok: true }) }))
vi.mock('@/lib/supabase/server', () => ({
  isDurablePersistenceConfigured: () => true,
  createServerSupabaseClient: () => ({
    from: (table: string) => {
      let operation: 'lookup' | 'update' | 'delete' | '' = ''
      const builder: any = {
        select: () => {
          if (!operation) operation = 'lookup'
          return builder
        },
        eq: (column: string, value: unknown) => {
          if (column === 'version') state.versionFilters.push(value)
          return builder
        },
        maybeSingle: async () => {
          if (operation === 'update') return { data: state.updateData, error: state.updateError }
          if (operation === 'delete') return { data: state.deleteData, error: state.deleteError }
          return {
            data: state.existingOwner ? { owner_id: state.existingOwner, version: state.existingVersion } : null,
            error: null,
          }
        },
        update: (payload: Record<string, unknown>) => {
          operation = 'update'
          state.updatePayload = payload
          return builder
        },
        delete: () => {
          operation = 'delete'
          return builder
        },
        insert: async (payload: Record<string, unknown>) => {
          state.insertPayload = payload
          return { data: null, error: state.insertError }
        },
        upsert: async () => {
          if (table !== 'role_workspaces') state.childWrites += 1
          return { data: null, error: null }
        },
      }
      return builder
    },
  }),
}))

import { DELETE, POST } from '@/app/api/roles/sync/route'

function workspace(withChild = false, expectedVersion?: number) {
  return {
    workspace: {
      id: ROLE_ID,
      status: 'active',
      intake: { title: 'Senior Sourcer' },
      searchLanes: withChild ? [{ id: 'lane-1', label: 'Core', purpose: '', query: 'sourcer', source: 'candidate_graph', status: 'approved' }] : [],
      candidates: [],
      activity: [],
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
  state.existingOwner = 'user-B'
  state.existingVersion = 1
  state.insertError = null
  state.updateData = { id: ROLE_ID }
  state.updateError = null
  state.deleteData = { id: ROLE_ID }
  state.deleteError = null
  state.insertPayload = null
  state.updatePayload = null
  state.versionFilters = []
  state.childWrites = 0
})

describe('/api/roles/sync owner and version safety', () => {
  it('rejects another owner’s role before any parent or child write', async () => {
    const response = await POST(request(workspace(true, 1)))
    expect(response.status).toBe(403)
    expect((await response.json()).code).toBe('role_owned_by_another')
    expect(state.insertPayload).toBeNull()
    expect(state.updatePayload).toBeNull()
    expect(state.childWrites).toBe(0)
  })

  it('updates only the expected version of a role owned by the authenticated user', async () => {
    state.existingOwner = 'user-A'
    const response = await POST(request(workspace(false, 1)))
    expect(response.status).toBe(200)
    expect(state.updatePayload).toMatchObject({ version: 2 })
    expect(state.updatePayload).not.toHaveProperty('owner_id')
    expect(state.versionFilters).toContain(1)
    expect(state.insertPayload).toBeNull()
  })

  it('requires a known server version before updating an existing role', async () => {
    state.existingOwner = 'user-A'
    const response = await POST(request(workspace()))
    expect(response.status).toBe(409)
    expect((await response.json()).code).toBe('role_version_required')
    expect(state.updatePayload).toBeNull()
  })

  it('rejects stale browser edits before any child write', async () => {
    state.existingOwner = 'user-A'
    state.existingVersion = 3
    const response = await POST(request(workspace(true, 2)))
    expect(response.status).toBe(409)
    expect((await response.json()).code).toBe('role_version_conflict')
    expect(state.updatePayload).toBeNull()
    expect(state.childWrites).toBe(0)
  })

  it('inserts a new role with the authenticated owner and version one', async () => {
    state.existingOwner = null
    const response = await POST(request(workspace()))
    expect(response.status).toBe(200)
    expect(state.insertPayload).toMatchObject({ id: ROLE_ID, owner_id: 'user-A', version: 1 })
    expect((await response.json()).version).toBe(1)
  })

  it('does not silently recreate a role that was deleted on the server', async () => {
    state.existingOwner = null
    const response = await POST(request(workspace(false, 4)))
    expect(response.status).toBe(409)
    expect((await response.json()).code).toBe('role_missing_on_server')
    expect(state.insertPayload).toBeNull()
  })

  it('returns 409 when a concurrent create wins the same role id', async () => {
    state.existingOwner = null
    state.insertError = { code: '23505', message: 'duplicate key' }
    const response = await POST(request(workspace(true)))
    expect(response.status).toBe(409)
    expect((await response.json()).code).toBe('role_create_conflict')
    expect(state.childWrites).toBe(0)
  })

  it('returns 409 when the version-scoped update affects no row', async () => {
    state.existingOwner = 'user-A'
    state.updateData = null
    const response = await POST(request(workspace(true, 1)))
    expect(response.status).toBe(409)
    expect((await response.json()).code).toBe('role_write_conflict')
    expect(state.childWrites).toBe(0)
  })

  it('writes child records only after the versioned parent write succeeds', async () => {
    state.existingOwner = null
    const response = await POST(request(workspace(true)))
    expect(response.status).toBe(200)
    expect(state.childWrites).toBe(1)
  })
})

describe('DELETE /api/roles/sync', () => {
  it('deletes only the authenticated owner’s expected role version', async () => {
    const response = await DELETE(deleteRequest(4))
    expect(response.status).toBe(200)
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
