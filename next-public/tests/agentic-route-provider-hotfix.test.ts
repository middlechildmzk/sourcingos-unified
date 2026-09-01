import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { describe, expect, it } from 'vitest'

const here = dirname(fileURLToPath(import.meta.url))

describe('agentic sourcing route provider hotfix', () => {
  it('wraps role-intelligence consumers in the canonical provider', () => {
    const source = readFileSync(join(here, '../app/app/agentic-sourcing/[id]/page.tsx'), 'utf8')
    expect(source).toContain("import { RoleIntelligenceProviderV33 } from '@/components/RoleIntelligenceProviderV33'")
    expect(source).toContain('<RoleIntelligenceProviderV33 roleId={id}>')
    expect(source).toContain('<RoleAgenticSearchPanel roleId={id} />')
    expect(source).toContain('</RoleIntelligenceProviderV33>')
  })
})
