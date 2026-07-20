import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(process.cwd())
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8')

describe('AutoSource V22 contract', () => {
  const migration = read('sql/autosource-v22.sql')
  const engine = read('lib/acquisition-engine-v22.ts')
  const cron = read('app/api/cron/autosource/route.ts')
  const route = read('app/api/autosource/campaigns/route.ts')

  it('owner-scopes every durable acquisition table', () => {
    for (const table of ['acquisition_campaigns','acquisition_runs','acquisition_discoveries','acquisition_source_cursors','candidate_quality_snapshots','autosource_inbox']) {
      expect(migration).toContain(`alter table public.${table} enable row level security`)
      expect(migration).toContain(`${table === 'candidate_quality_snapshots' ? 'candidate_quality' : table.replace('acquisition_source_cursors','acquisition_source_cursors').replace('autosource_inbox','autosource_inbox')}_owner_select`)
    }
    expect(migration).toContain('revoke all on public.acquisition_campaigns')
  })

  it('requires authenticated server routes and a secret-gated cron', () => {
    expect(route).toContain('requireSession()')
    expect(route).toContain("rateLimit(req, 'workbench'")
    expect(cron).toContain('process.env.CRON_SECRET')
    expect(cron).toContain("status: 401")
  })

  it('uses strict auto-promotion thresholds and preserves review', () => {
    expect(engine).toContain('d.identityConfidence >= input.autoPromoteThreshold')
    expect(engine).toContain("'needs_review'")
    expect(engine).toContain("'auto_promoted'")
    expect(engine).toContain("'duplicate'")
  })

  it('does not add outreach or restricted-platform scraping', () => {
    const domain = read('lib/acquisition-v22.ts').toLowerCase()
    expect(domain).not.toContain('linkedin.com/voyager')
    expect(domain).not.toContain('send_email')
    expect(domain).not.toContain('auto_outreach')
  })
})
