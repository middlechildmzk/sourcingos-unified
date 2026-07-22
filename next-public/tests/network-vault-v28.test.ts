import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(__dirname, '..')
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8')

const route = read('app/api/network/list/route.ts')
const client = read('components/NetworkVaultClient.tsx')

describe('V28 Network Vault stabilization', () => {
  it('uses bounded server pagination instead of a hard 300-row ceiling', () => {
    expect(route).toContain('DEFAULT_LIMIT = 50')
    expect(route).toContain('MAX_LIMIT = 100')
    expect(route).toContain('.range(offset, offset + limit - 1)')
    expect(route).toContain("page: { limit, offset, hasMore")
    expect(route).not.toContain('MAX_ROWS = 300')
  })

  it('filters LinkedIn import rows in the owner-scoped database query', () => {
    expect(route).toContain(".eq('owner_id', gate.userId)")
    expect(route).toContain(".eq('source', IMPORT_SOURCE)")
    expect(route).toContain(".contains('raw', { importType: IMPORT_TYPE })")
    expect(route).toContain("rateLimit(req, 'workbench', gate.userId)")
  })

  it('renders meaningful relationship lifecycle states rather than universal Pending', () => {
    expect(client).toContain("label: 'In Candidate Graph'")
    expect(client).toContain("label: 'Identity confirmed'")
    expect(client).toContain("label: 'Kept separate'")
    expect(client).toContain("label: 'Relationship only'")
    expect(client).not.toContain('<SignalChip label="Pending"')
  })

  it('provides page navigation and labels quick filters as page-local', () => {
    expect(client).toContain('Previous page')
    expect(client).toContain('Next page')
    expect(client).toContain('Search your full network')
    expect(client).toContain('Has email on page')
    expect(client).toContain('Company on this page')
  })
})
