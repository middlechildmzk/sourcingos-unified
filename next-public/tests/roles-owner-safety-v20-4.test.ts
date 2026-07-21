import { beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({
  existingOwner: 'user-B' as string | null,
  existingVersion: 1,
  insertError: null as null | { code?: string; message: string },
  updateData: { id: '11111111-1111-4111-8111-111111111111' } as { id: string } | null,
  updateError: null as null | { message: string },
  insertPayload: null as Record<string, unknown> | null,
  updatePayload: null as Record<string, unknown> | null,
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
      let operation: 'lookup' | 'update' | '' = ''
      const builder: any = {
        select: () => {
          if (!operation) operation = 'lookup'
          return builder
        },
        eq: () => builder,
        maybeSingle: async () => {
          if (operation === 'update') return { data: state.updateData, error: state.updateError }
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

import { POST } from '@/app/api/roles/sync/route'

const ROLE_ID = '11111111-1111-4111-8111-111111111111'

function workspace(withChild = false) {
  return {
    workspace: {
      id: ROLE_ID,
      status: 'active',
      intake: { title: 'Senior Sourcer' },
      searchLanes: withChild ? [{ id: 'lane-1', label: 'Core', purpose: '', query: 'sourcer', source: 'candidate_graph', status: 'approved' }] : [],
      candidates: [],
      activity: [],
    },
  }
}

function request(body: unknown) {
  return {
    json: async () => body,
    headers: new Headers(),
    url: 'http://localhost/api/roles/sync',
  } as any
}

beforeEach(() => {
  state.existingOwner = 'user-B'
  state.existingVersion = 1
  state.insertError = null
  state.updateData = { id: ROLE_ID }
  state.updateError = null
  state.insertPayload = null
  state.updatePayload = null
  state.childWrites = 0
})

describe('/api/roles/sync owner safety', () => {
  it('rejects another owner’s role before any parent or child write', async () => {
    const response = await POST(request(workspace(true)))
    expect(response.status).toBe(403)
    expect((await response.json()).code).toBe('role_owned_by_another')
    expect(state.insertPayload).toBeNull()
    expect(state.updatePayload).toBeNull()
    expect(state.childWrites).toBe(0)
  })

  it('updates only a role owned by the authenticated user and never rewrites owner_id', async () => {
    state.existingOwner = 'user-A'
    const response = await POST(request(workspace()))
    expect(response.status).toBe(200)
    expect(state.updatePayload).not.toHaveProperty('owner_id')
    expect(state.insertPayload).toBeNull()
  })

  it('inserts a new role with the authenticated owner', async () => {
    state.existingOwner = null
    const response = await POST(request(workspace()))
    expect(response.status).toBe(200)
    expect(state.insertPayload).toMatchObject({ id: ROLE_ID, owner_id: 'user-A' })
  })

  it('returns 409 when a concurrent create wins the same role id', async () => {
    state.existingOwner = null
    state.insertError = { code: '23505', message: 'duplicate key' }
    const response = await POST(request(workspace(true)))
    expect(response.status).toBe(409)
    expect((await response.json()).code).toBe('role_create_conflict')
    expect(state.childWrites).toBe(0)
  })

  it('returns 409 when the owner-scoped update affects no row', async () => {
    state.existingOwner = 'user-A'
    state.updateData = null
    const response = await POST(request(workspace(true)))
    expect(response.status).toBe(409)
    expect((await response.json()).code).toBe('role_write_conflict')
    expect(state.childWrites).toBe(0)
  })

  it('writes child records only after the parent write succeeds', async () => {
    state.existingOwner = null
    const response = await POST(request(workspace(true)))
    expect(response.status).toBe(200)
    expect(state.childWrites).toBe(1)
  })
})
