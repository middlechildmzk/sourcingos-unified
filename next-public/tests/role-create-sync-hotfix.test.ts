import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { describe, expect, it } from 'vitest'

const here = dirname(fileURLToPath(import.meta.url))

describe('new role account-sync hotfix', () => {
  it('persists newly created roles immediately instead of relying on an unmount-cancellable debounce', () => {
    const source = readFileSync(join(here, '../lib/use-role-workspaces.ts'), 'utf8')
    const start = source.indexOf('const addRole = useCallback')
    const end = source.indexOf('const updateRole = useCallback')
    const addRole = source.slice(start, end)

    expect(addRole).toContain('commit(next)')
    expect(addRole).toContain('void syncWorkspace(prepared)')
    expect(addRole).not.toContain('commit(next, [workspace.id])')
    expect(addRole).not.toContain('scheduleSync(')
  })
})
