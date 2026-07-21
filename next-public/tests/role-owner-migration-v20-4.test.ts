import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(
  join(process.cwd(), 'supabase/migrations/20260721173000_role_workspace_owner_safety.sql'),
  'utf8'
)

const childTables = ['role_search_lanes', 'role_candidates', 'role_activity']
const roleTables = ['role_workspaces', ...childTables]

describe('role owner safety migration', () => {
  it('adds composite parent-child ownership constraints', () => {
    expect(migration).toContain('unique (id, owner_id)')
    for (const table of childTables) {
      expect(migration).toContain(`alter table public.${table}`)
      expect(migration).toContain('foreign key (role_id, owner_id)')
      expect(migration).toContain('references public.role_workspaces(id, owner_id)')
    }
  })

  it('requires both row ownership and parent role ownership for child reads', () => {
    for (const table of childTables) {
      expect(migration).toContain(`where rw.id = ${table}.role_id`)
    }
    expect((migration.match(/rw\.owner_id = \(select auth\.uid\(\)\)/g) || []).length).toBe(3)
  })

  it('keeps authenticated clients read-only', () => {
    for (const table of roleTables) {
      expect(migration).toContain(`revoke all on public.${table} from anon, authenticated`)
      expect(migration).toContain(`grant select on public.${table} to authenticated`)
    }

    expect(migration).not.toMatch(/grant\s+(?:insert|update|delete)/i)
    expect(migration).not.toMatch(/grant\s+select\s*,\s*insert/i)
    expect(migration).not.toMatch(/create policy [^\n]+\n\s+for (?:insert|update|delete)/i)
  })

  it('removes historical direct-write policies defensively', () => {
    for (const table of roleTables) {
      for (const operation of ['insert', 'update', 'delete']) {
        expect(migration).toContain(`drop policy if exists ${table}_owner_${operation}`)
      }
    }
  })

  it('creates one version-locked atomic snapshot transaction', () => {
    expect(migration).toContain('create or replace function public.save_role_workspace_snapshot')
    expect(migration).toContain('security invoker')
    expect(migration).toContain("set search_path = ''")
    expect(migration).toContain('for update')
    expect(migration).toContain('p_expected_version <> v_current_version')
    expect(migration).toContain("'role_version_conflict'")
    expect(migration).toContain("'role_missing_on_server'")
    expect(migration).toContain("'role_create_conflict'")

    for (const conflictKey of ['role_id, lane_key', 'role_id, identity_key', 'role_id, event_key']) {
      expect(migration).toContain(`on conflict (${conflictKey}) do update`)
    }

    for (const table of childTables) {
      expect(migration).not.toContain(`delete from public.${table} existing`)
    }
    expect(migration).toContain('without deleting server-only additions')
  })

  it('restricts the snapshot RPC to service role', () => {
    const signature = 'public.save_role_workspace_snapshot(\n  uuid, uuid, integer, jsonb, jsonb, jsonb, jsonb, timestamptz\n)'
    expect(migration).toContain(`revoke all on function ${signature} from PUBLIC, anon, authenticated`)
    expect(migration).toContain(`grant execute on function ${signature} to service_role`)
    expect(migration).not.toMatch(/grant execute on function[^;]+to authenticated/i)
  })
})
