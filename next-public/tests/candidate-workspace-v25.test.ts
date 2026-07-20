import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(__dirname, '..')
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8')

const listRoute = read('app/api/candidate-db/list/route.ts')
const workspace = read('lib/candidate-workspace-v25.ts')
const resumeImport = read('app/api/candidate-db/import-resume/route.ts')
const csvImport = read('app/api/candidate-db/import-csv/route.ts')
const client = read('components/CandidateDbClient.tsx')
const page = read('app/app/candidate-database/page.tsx')

describe('V25 Candidate Graph workspace', () => {
  it('returns one normalized contract in preview and Supabase modes', () => {
    expect(listRoute).toContain('getCandidateWorkspace')
    expect(listRoute).toContain("persistence_mode: 'preview'")
    expect(listRoute).toContain('filteredCandidates')
    expect(workspace).toContain("persistence_mode: 'supabase'")
    expect(workspace).toContain('sourceProfileIds')
    expect(workspace).toContain('evidenceItemIds')
    expect(workspace).toContain('pendingMatchReviews')
  })

  it('uses bounded server-side search and pagination', () => {
    expect(workspace).toContain('Math.min(200')
    expect(workspace).toContain('.range(offset, offset + limit - 1)')
    expect(workspace).toContain('canonical_name.ilike')
    expect(listRoute).toContain("req.nextUrl.searchParams.get('q')")
  })

  it('persists resume imports with the authenticated owner and no header fallback', () => {
    expect(resumeImport).toContain('persistCandidateGraphSnapshot(snapshot, gate.userId)')
    expect(resumeImport).not.toContain('getUserIdFromHeader')
    expect(resumeImport).toContain('const preview = gate.preview || !isSupabaseConfigured()')
    expect(resumeImport.indexOf('if (preview)')).toBeLessThan(resumeImport.indexOf('getCandidateDb()'))
  })

  it('persists request-local CSV snapshots instead of production global state', () => {
    expect(csvImport).toContain('const snapshot: CandidateDbSnapshot')
    expect(csvImport).toContain('persistCandidateGraphSnapshot(snapshot, gate.userId)')
    expect(csvImport).toContain('const preview = gate.preview || !isSupabaseConfigured()')
    expect(csvImport.indexOf('if (preview)')).toBeLessThan(csvImport.indexOf('getCandidateDb()'))
    expect(csvImport).toContain('maximumRows = 1000')
  })

  it('makes search and candidate review primary while hiding imports', () => {
    expect(client).toContain('Search name, title, company, or location')
    expect(client).toContain('Import authorized candidate data')
    expect(client).toContain('<details')
    expect(client).toContain('Open 360')
    expect(page).toContain('<h1>Candidates</h1>')
    expect(page).not.toContain('SourcingOS V19')
  })
})
