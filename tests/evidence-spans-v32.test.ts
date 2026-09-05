import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(__dirname, '..')
const migration = fs.readFileSync(path.join(root, 'supabase/migrations/20260830113000_evidence_item_source_spans.sql'), 'utf8').toLowerCase()
const persistence = fs.readFileSync(path.join(root, 'lib/supabase-candidate-graph.ts'), 'utf8')
const ledger = fs.readFileSync(path.join(root, 'lib/supabase-evidence-ledger.ts'), 'utf8')
const deleteMigration = fs.readFileSync(path.join(root, 'supabase/migrations/20260829160000_candidate_bundle_delete.sql'), 'utf8').toLowerCase()

describe('V32 evidence span persistence', () => {
  it('adds nullable span columns without replacing legacy evidence rows', () => {
    for (const column of ['span_start', 'span_end', 'span_text', 'source_text_ref']) {
      expect(migration).toContain(`add column if not exists ${column}`)
    }
    expect(migration).toContain('span_start is null and span_end is null and span_text is null and source_text_ref is null')
  })

  it('requires a complete source-linked span when any span field is present', () => {
    expect(migration).toContain('source_profile_id is not null')
    expect(migration).toContain('span_start >= 0')
    expect(migration).toContain('span_end > span_start')
    expect(migration).toContain('evidence_items_source_span_complete')
  })

  it('does not weaken grants, RLS, or ownership in the additive migration', () => {
    expect(migration).not.toContain('disable row level security')
    expect(migration).not.toMatch(/grant\s+(insert|update|delete|all)/)
    expect(migration).not.toContain('drop policy')
    expect(migration).not.toContain('alter policy')
  })

  it('round-trips span fields through the owner-scoped candidate graph persistence adapter', () => {
    expect(persistence).toContain('owner_id: owner')
    expect(persistence).toContain('span_start: e.spanStart')
    expect(persistence).toContain('span_end: e.spanEnd')
    expect(persistence).toContain('span_text: e.spanText')
    expect(persistence).toContain('source_text_ref: e.sourceTextRef')
  })

  it('loads stored raw source text and span fields for server-side revalidation', () => {
    expect(ledger).toContain('raw_text')
    expect(ledger).toContain('span_start')
    expect(ledger).toContain('span_end')
    expect(ledger).toContain('span_text')
    expect(ledger).toContain('source_text_ref')
  })

  it('inherits candidate hard-delete guarantees through evidence/source-profile cascades', () => {
    expect(deleteMigration).toContain('delete from public.source_profiles')
    expect(deleteMigration).toContain('delete from public.candidates')
    expect(deleteMigration).toContain('deleting source profiles cascades their evidence')
    expect(deleteMigration).toContain('deleting the canonical candidate cascades')
  })
})
