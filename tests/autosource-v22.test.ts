import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(process.cwd())
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8')

describe('AutoSource V22 contract', () => {
  const migration = read('sql/autosource-v22.sql')
  const engine = read('lib/acquisition-engine-v22.ts')
  const cron = read('app/api/cron/autosource/route.ts')
  const cronAuth = read('lib/cron-auth.ts')
  const route = read('app/api/autosource/campaigns/route.ts')
  const vercel = read('vercel.json')

  it('owner-scopes every durable acquisition table', () => {
    for (const table of ['acquisition_campaigns','acquisition_runs','acquisition_discoveries','acquisition_source_cursors','candidate_quality_snapshots','autosource_inbox']) {
      expect(migration).toContain(`alter table public.${table} enable row level security`)
      expect(migration).toContain(`${table === 'candidate_quality_snapshots' ? 'candidate_quality' : table.replace('acquisition_source_cursors','acquisition_source_cursors').replace('autosource_inbox','autosource_inbox')}_owner_select`)
    }
    expect(migration).toContain('revoke all on public.acquisition_campaigns')
  })

  it('requires authenticated server routes and keeps the legacy cron endpoint header-secret-gated', () => {
    expect(route).toContain('requireSession()')
    expect(route).toContain("rateLimit(req, 'workbench'")
    expect(cron).toContain('authorizeCronRequest(req)')
    expect(cron).toContain("status: 401")
    expect(cronAuth).toContain('process.env.CRON_SECRET')
    expect(cronAuth).toContain("request.headers.get('authorization')")
    expect(cronAuth).toContain("request.headers.get('x-cron-secret')")
    expect(cronAuth).not.toContain('searchParams')
  })

  it('schedules hardened discovery and enrichment endpoints, never legacy AutoSource cron', () => {
    const fleetCron = read('app/api/cron/fleet/route.ts')
    const enrichmentCron = read('app/api/cron/enrichment/route.ts')
    expect(vercel).toContain('/api/cron/fleet/')
    expect(vercel).toContain('*/30 * * * *')
    expect(vercel).toContain('/api/cron/enrichment/')
    expect(vercel).toContain('*/15 * * * *')
    expect(vercel).not.toContain('/api/cron/autosource')
    expect(fleetCron).toContain('authorizeCronRequest')
    expect(fleetCron).toContain('claimDueFleetLanesV40')
    expect(fleetCron).toContain('runFleetLaneV40')
    expect(enrichmentCron).toContain('authorizeCronRequest')
    expect(enrichmentCron).toContain('runEnrichmentTickV40_4')
  })

  it('keeps every automated discovery in recruiter review and forbids automated Candidate Graph promotion', () => {
    expect(engine).toContain("const disposition = 'needs_review' as const")
    expect(engine).toContain('Automated Candidate Graph promotion is disabled; recruiter review is required.')
    expect(engine).not.toContain("'auto_promoted'")
    expect(engine).toContain("merge_status: 'pending'")
    expect(engine).toContain("confidence: 'medium'")
    expect(engine).toContain("'duplicate'")
  })

  it('does not add outreach or restricted-platform scraping', () => {
    const domain = read('lib/acquisition-v22.ts').toLowerCase()
    expect(domain).not.toContain('linkedin.com/voyager')
    expect(domain).not.toContain('send_email')
    expect(domain).not.toContain('auto_outreach')
  })
})
