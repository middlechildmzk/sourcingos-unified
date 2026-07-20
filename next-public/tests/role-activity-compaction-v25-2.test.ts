import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

const source = fs.readFileSync(path.resolve(__dirname, '../lib/role-workspace-storage.ts'), 'utf8')

describe('V25.2 role activity compaction', () => {
  it('deduplicates repetitive intake edit events while preserving other audit events', () => {
    expect(source).toContain('compactActivity')
    expect(source).toContain("if (event.type !== 'intake_updated') return true")
    expect(source).toContain('seenIntakeUpdates')
    expect(source).toContain('.slice(0, 2000)')
  })

  it('compacts both browser writes and account hydration merges', () => {
    expect(source).toContain('roles.splice(0, roles.length, ...compacted)')
    expect(source).toContain('activity: compactActivity(Array.from(activity.values()))')
  })
})
