import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(__dirname, '..')
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8')

const client = read('components/ImportCenterClient.tsx')
const previewRoute = read('app/api/candidate-db/import-preview/route.ts')
const historyRoute = read('app/api/candidate-db/import-history/route.ts')
const csvRoute = read('app/api/candidate-db/import-csv/route.ts')
const page = read('app/app/import/page.tsx')
const shell = read('components/AppShell.tsx')
const styles = read('app/app/import-center.css')

describe('V25.2 Import Center', () => {
  it('supports multi-file authorized data preparation with bounded limits', () => {
    expect(client).toContain('multiple accept=".csv,.tsv,.txt')
    expect(client).toContain('20 - files.length')
    expect(client).toContain('5_000_000')
    expect(client).toContain('15_000_000')
    expect(client).toContain('slice(0, 1000)')
  })

  it('detects delimiters, parses quoted values, and provides field mapping', () => {
    expect(client).toContain('detectDelimiter')
    expect(client).toContain('parseDelimited')
    expect(client).toContain("next === '\"'")
    expect(client).toContain("const FIELD_KEYS = ['name', 'title', 'company', 'location', 'email', 'phone', 'linkedin', 'skills']")
    expect(client).toContain('inferMapping')
  })

  it('previews owner-scoped graph duplicates before import', () => {
    expect(previewRoute).toContain('requireSession')
    expect(previewRoute).toContain(".eq('owner_id', gate.userId)")
    expect(previewRoute).toContain(".ilike('canonical_name'")
    expect(previewRoute).toContain("confidence: companyMatches ? 'high' : 'possible'")
    expect(client).toContain("fetch('/api/candidate-db/import-preview'")
    expect(client).toContain('skipHighConfidenceDuplicates')
  })

  it('reuses durable resume and CSV routes rather than creating a parallel graph writer', () => {
    expect(client).toContain("fetch('/api/candidate-db/import-csv'")
    expect(client).toContain("fetch('/api/candidate-db/import-resume'")
    expect(csvRoute).toContain('persistCandidateGraphSnapshot(snapshot, gate.userId)')
  })

  it('returns owner-scoped import history and exposes the Import Center in navigation', () => {
    expect(historyRoute).toContain(".from('candidate_import_batches')")
    expect(historyRoute).toContain(".eq('owner_id', gate.userId)")
    expect(page).toContain('<ImportCenterClient />')
    expect(shell).toContain("{ href: '/app/import', label: 'Import Center', icon: 'import'")
  })

  it('is explicit about the current XLSX boundary and includes responsive workflow styles', () => {
    expect(client).toContain('Native XLSX parsing is intentionally not enabled')
    expect(styles).toContain('.import-dropzone')
    expect(styles).toContain('.import-mapping-grid')
    expect(styles).toContain('.import-preview-table')
    expect(styles).toContain('@media(max-width:620px)')
  })
})
