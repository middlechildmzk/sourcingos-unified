import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(process.cwd())
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8')

describe('V40 autonomous fleet integration', () => {
  it('keeps discovery capture evidence-only and recruiter-controlled', () => {
    const capture = read('lib/fleet/capture-discovery-v40.ts')
    expect(capture).toContain('identityMergeAuthorized: false')
    expect(capture).toContain('count_auto_promoted: 0')
    expect(capture).not.toContain('confirm_identity_match_atomic_v34')
  })

  it('uses atomic owner-scoped credit admission and atomic lane claims', () => {
    const migration = read('supabase/migrations/20260904222000_v40_2_autonomous_fleet.sql')
    expect(migration).toContain('owner_id uuid not null')
    expect(migration).toContain('pg_advisory_xact_lock')
    expect(migration).toContain('reserve_fleet_credits_v40')
    expect(migration).toContain('for update skip locked')
    expect(migration).toContain('claim_due_fleet_lanes_v40')
    expect(migration).toContain('count_auto_promoted integer not null default 0 check (count_auto_promoted = 0)')
  })

  it('activates secured discovery, enrichment, and bounded resume sprint cron schedules', () => {
    const config = JSON.parse(read('vercel.json'))
    expect(config.crons).toEqual([
      { path: '/api/cron/fleet/', schedule: '*/30 * * * *' },
      { path: '/api/cron/enrichment/', schedule: '*/15 * * * *' },
      { path: '/api/cron/resume-sprint/', schedule: '*/3 * * * *' },
    ])
    const route = read('app/api/cron/fleet/route.ts')
    const enrichment = read('app/api/cron/enrichment/route.ts')
    const resumeSprint = read('app/api/cron/resume-sprint/route.ts')
    expect(route).toContain('authorizeCronRequest')
    expect(route).toContain('claimDueFleetLanesV40(sb, 4)')
    expect(route).toContain('identityMergeAuthorized: false')
    expect(enrichment).toContain('runEnrichmentTickV40_4(sb)')
    expect(resumeSprint).toContain('authorizeCronRequest(req)')
    expect(resumeSprint).toContain('runResumeSprintTickV40_5(sb)')
  })

  it('treats ORCID employment as an affiliation, not a license', () => {
    const source = read('lib/fleet/scouts/orcid-scout.ts')
    expect(source).toContain("type: 'professional_affiliation'")
  })
})
