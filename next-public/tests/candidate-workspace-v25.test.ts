import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(__dirname, '..')
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8')

const listRoute = read('app/api/candidate-db/list/route.ts')
const workspace = read('lib/candidate-workspace-v25.ts')
const resumeImport = read('app/api/candidate-db/import-resume/route.ts')
const csvImport = read('app/api/candidate-db/import-csv/route.ts')
const page = read('app/app/candidate-database/page.tsx')
const talent = read('components/TalentWorkspaceV37.tsx')
const sources = read('components/SourcesWorkspaceV37.tsx')
const candidate360 = read('components/Candidate360Client.tsx')
const candidate360Page = read('app/app/candidate/[id]/page.tsx')

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
    expect(workspace).toContain('searchCandidateGraphIdsV36_10')
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

  it('makes the V37 Talent library the primary canonical-person review surface and moves imports to Sources', () => {
    expect(page).toContain('<TalentWorkspaceV37')
    expect(talent).toContain('Your canonical people library.')
    expect(talent).toContain('Search name, skill, company, email, profile URL')
    expect(talent).toContain('href="/app/identity-review"')
    expect(talent).toContain('Open Candidate 360')
    expect(sources).toContain('href="/app/import"')
    expect(sources).toContain('Import center')
    expect(page).not.toContain('SourcingOS V19')
  })

  it('makes Candidate 360 evidence-first and hides sensitive internals', () => {
    expect(candidate360).toContain('Professional evidence')
    expect(candidate360).toContain('Source profiles')
    expect(candidate360).toContain('Contact research')
    expect(candidate360).toContain('Availability signals')
    expect(candidate360).toContain("action: 'extract_graph'")
    expect(candidate360).toContain("action: 'queue_enrichment'")
    expect(candidate360).toContain('AddToRoleButton')
    expect(candidate360Page).toContain('CandidateFieldResolutionV36_10')
    expect(candidate360Page).toContain('CandidateArtifactsV36_10')
    expect(candidate360Page).not.toContain('CandidateRoleHandoff')
    expect(candidate360Page).not.toContain('Preview mode:')
  })
})
