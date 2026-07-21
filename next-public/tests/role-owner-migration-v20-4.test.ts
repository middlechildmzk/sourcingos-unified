import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(
  join(process.cwd(), 'supabase/migrations/20260721173000_role_workspace_owner_safety.sql'),
  'utf8'
)

const childTables = ['role_search_lanes', 'role_candidates', 'role_activity']

describe('role owner safety migration', () => {
  it('adds composite parent-child ownership constraints', () => {
    expect(migration).toContain('unique (id, owner_id)')
    for (const table of childTables) {
      expect(migration).toContain(`alter table public.${table}`)
      expect(migration).toContain('foreign key (role_id, owner_id)')
      expect(migration).toContain('references public.role_workspaces(id, owner_id)')
    }
  })

  it('requires both row ownership and parent role ownership for child policies', () => {
    for (const table of childTables) {
      expect(migration).toContain(`where rw.id = ${table}.role_id`)
    }
    expect((migration.match(/rw\.owner_id = \(select auth\.uid\(\)\)/g) || []).length).toBeGreaterThanOrEqual(12)
  })

  it('protects update ownership with USING and WITH CHECK', () => {
    expect((migration.match(/for update to authenticated/g) || []).length).toBe(4)
    expect((migration.match(/with check \(/g) || []).length).toBeGreaterThanOrEqual(7)
  })
})
