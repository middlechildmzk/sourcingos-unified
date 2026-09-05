import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(process.cwd())
const read = (relative: string) => fs.readFileSync(path.join(root, relative), 'utf8')

describe('V40.5b Resume/CV sprint yield correction', () => {
  it('keeps the cohort bounded while forcing the general PDF queries first', () => {
    const migration = read('supabase/migrations/20260905024000_v40_5b_resume_yield_general_first.sql')
    expect(migration).toContain("payload->>'batchTag' = 'v40_5_resume_sprint_5000'")
    expect(migration).toContain("'{queryOffset}', '0'::jsonb")
    expect(migration).toContain('v40_5b_general_pdf_first')
    expect(migration).not.toContain('insert into public.candidate_enrichment_tasks')
    expect(migration).toContain("status = 'complete'")
    expect(migration).toContain("result_summary->>'found'")
  })

  it('retains the public-only trust boundary in the sprint runtime', () => {
    const runtime = read('lib/fleet/resume-sprint-v40-5.ts')
    expect(runtime).toContain('authBypassAllowed: false')
    expect(runtime).toContain('paywallBypassAllowed: false')
    expect(runtime).toContain('contactValuesCaptured: false')
    expect(runtime).toContain('identityMergeAuthorized: false')
    expect(runtime).toContain('recruiterDecisionAutomated: false')
  })
})
