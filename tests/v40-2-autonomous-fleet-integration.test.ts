import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { technicalDossierToSourceResultV40 } from '../lib/fleet/dossier-source-result'
import type { TechnicalDossier } from '../lib/connectors/contract-v33-3'

const root = process.cwd()
const read = (path: string) => readFileSync(join(root, path), 'utf8')

function dossier(): TechnicalDossier {
  return {
    source: 'orcid',
    person: {
      source: 'orcid',
      sourceProfileId: '0000-0002-1825-0097',
      profileUrl: 'https://orcid.org/0000-0002-1825-0097',
      displayName: 'Amara Okonkwo',
      publicEmail: 'fixture-at-invalid.test',
      websites: ['https://github.com/aokonkwo'],
    },
    artifacts: [],
    technologies: [],
    anchors: [
      { kind: 'orcid', value: '0000-0002-1825-0097', normalized: '0000-0002-1825-0097', strength: 'deterministic', provenance: { source: 'orcid', sourceField: 'orcid-identifier.path', sourceRecordId: '0000-0002-1825-0097', basis: 'source_stated', observedAt: '2026-09-04T12:00:00.000Z' } },
      { kind: 'public_email', value: 'fixture-at-invalid.test', normalized: 'fixture-at-invalid.test', strength: 'deterministic', provenance: { source: 'orcid', sourceField: 'fixture', sourceRecordId: '0000-0002-1825-0097', basis: 'source_stated', observedAt: '2026-09-04T12:00:00.000Z' } },
    ],
    activity: { activeYears: [] },
    limits: [],
    observedAt: '2026-09-04T12:00:00.000Z',
    raw: {},
  }
}

describe('V40 autonomous fleet integration', () => {
  it('converts dossiers to person SourceResults without unattended contact values', () => {
    const result = technicalDossierToSourceResultV40(dossier())
    expect(result.entityKind).toBe('person')
    expect(result.contactSignals).toEqual([])
    expect(JSON.stringify(result.raw)).not.toContain('fixture-at-invalid.test')
    expect(result.deterministicIdentityAnchors?.map(item => item.kind)).toEqual(['orcid'])
  })

  it('keeps the fleet proposal-only and reuses the canonical Identity Review path', () => {
    const types = read('lib/fleet/types.ts')
    const orchestrator = read('lib/fleet/orchestrator.ts')
    const capture = read('lib/candidate-data/capture-source-result-v40.ts')
    expect(types).not.toContain("kind: 'deterministic_link'")
    expect(orchestrator).not.toContain('recordDeterministicLink')
    expect(capture).toContain('createDeterministicIdentityProposals')
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
