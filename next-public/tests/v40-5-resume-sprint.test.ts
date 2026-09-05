import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import {
  RESUME_SPRINT_BATCH_V40_5,
  RESUME_SPRINT_CLAIM_LIMIT_V40_5,
  RESUME_SPRINT_CONCURRENCY_V40_5,
  resumeSprintQueriesV40_5,
} from '@/lib/fleet/resume-sprint-v40-5'

const root = path.resolve(process.cwd())
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8')

describe('V40.5 governed Resume/CV sprint', () => {
  it('targets the agreed 5,000-candidate sprint with bounded worker concurrency', () => {
    expect(RESUME_SPRINT_BATCH_V40_5).toBe('v40_5_resume_sprint_5000')
    expect(RESUME_SPRINT_CLAIM_LIMIT_V40_5).toBe(36)
    expect(RESUME_SPRINT_CONCURRENCY_V40_5).toBe(6)
    const migration = read('supabase/migrations/20260905020500_v40_5_resume_sprint_5000.sql')
    expect(migration).toContain('limit 5000')
    expect(migration).toContain("'linkedin_export'")
    expect(migration).toContain("'linkedin_connections'")
    expect(migration).toContain('for update skip locked')
    expect(migration).toContain('claim_resume_sprint_tasks_v40_5')
  })

  it('fans public document search across direct files, cloud docs, portfolios, academic CVs, and metadata-only hosts', () => {
    const queries = resumeSprintQueriesV40_5({ id: 'c1', canonical_name: 'Jane Engineer', current_company: 'Acme Federal', current_title: 'Linux Engineer' })
    const text = queries.join('\n')
    expect(queries).toHaveLength(10)
    expect(text).toContain('filetype:pdf')
    expect(text).toContain('site:drive.google.com')
    expect(text).toContain('site:github.io')
    expect(text).toContain('site:amazonaws.com')
    expect(text).toContain('site:dropbox.com')
    expect(text).toContain('site:vercel.app')
    expect(text).toContain('site:netlify.app')
    expect(text).toContain('site:carrd.co')
    expect(text).toContain('site:scribd.com')
    expect(text).toContain('site:researchgate.net')
  })

  it('keeps restricted hosts metadata-only and preserves trust boundaries', () => {
    const sprint = read('lib/fleet/resume-sprint-v40-5.ts')
    expect(sprint).toContain("'restricted_metadata_only'")
    expect(sprint).toContain('authBypassAllowed: false')
    expect(sprint).toContain('paywallBypassAllowed: false')
    expect(sprint).toContain('contactValuesCaptured: false')
    expect(sprint).toContain('identityMergeAuthorized: false')
    expect(sprint).not.toContain('residential proxy')
    expect(sprint).not.toContain('captcha bypass')
  })

  it('uses a separate protected scheduler so the normal enrichment lane remains bounded', () => {
    const route = read('app/api/cron/resume-sprint/route.ts')
    expect(route).toContain('authorizeCronRequest(req)')
    expect(route).toContain("auth !== 'authorized'")
    expect(route).toContain('runResumeSprintTickV40_5(sb)')
    const config = JSON.parse(read('vercel.json'))
    expect(config.crons).toContainEqual({ path: '/api/cron/resume-sprint/', schedule: '*/3 * * * *' })
  })
})
