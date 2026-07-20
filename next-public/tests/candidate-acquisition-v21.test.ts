import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const sql = readFileSync(join(process.cwd(), 'sql/candidate-acquisition-v21.sql'), 'utf8').toLowerCase()
const api = readFileSync(join(process.cwd(), 'app/api/candidate-acquisition/route.ts'), 'utf8').toLowerCase()

describe('V21 Candidate Acquisition Hub', () => {
  it('creates owner-scoped acquisition tables', () => {
    expect(sql).toContain('create table if not exists public.candidate_source_registry')
    expect(sql).toContain('create table if not exists public.candidate_enrichment_queue')
    expect(sql).toContain('create table if not exists public.candidate_growth_targets')
    expect(sql).toContain('owner_id = (select auth.uid())')
  })

  it('does not grant browser writes to acquisition tables', () => {
    expect(sql).toContain('revoke all on public.candidate_enrichment_queue from anon, authenticated')
    expect(sql).not.toMatch(/grant\s+(insert|update|delete|all)\s+on\s+public\.candidate_(source_registry|enrichment_queue|growth_targets)/)
  })

  it('uses authorized source lanes and preserves recruiter review boundaries', () => {
    expect(api).toContain('linkedin connections export')
    expect(api).toContain('github public profiles')
    expect(api).toContain('orcid')
    expect(api).toContain('uspto inventors')
    expect(api).toContain('identity linking requires review')
  })
})
