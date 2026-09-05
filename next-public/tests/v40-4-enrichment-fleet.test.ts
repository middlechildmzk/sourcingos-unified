import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { FLEET_AGENTS_V40_4, fleetAgentSummaryV40_4 } from '@/lib/fleet/agent-registry-v40-4'
import { parseResumeFactsV40_4, resumeIdentityConfidenceV40_4, resumeSearchQueriesV40_4, scrubUnattendedContactValuesV40_4 } from '@/lib/fleet/resume-intelligence-v40-4'

const root = path.resolve(process.cwd())
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8')

describe('V40.4 50-agent enrichment fleet', () => {
  it('defines exactly 50 specialized logical agents with the agreed team split', () => {
    const summary = fleetAgentSummaryV40_4()
    expect(FLEET_AGENTS_V40_4).toHaveLength(50)
    expect(summary.byTeam).toEqual({
      discovery: 18,
      resume_cv: 12,
      enrichment: 10,
      identity_verification: 6,
      operations_quality: 4,
    })
  })

  it('builds public Resume/CV search variants without guessing private identifiers', () => {
    const queries = resumeSearchQueriesV40_4({ id: 'c1', canonical_name: 'Jane Engineer', current_company: 'Acme Federal', location: 'Maryland' })
    expect(queries).toHaveLength(7)
    expect(queries.join('\n')).toContain('filetype:pdf')
    expect(queries.join('\n')).toContain('site:drive.google.com')
    expect(queries.join('\n')).toContain('site:github.com')
    expect(queries.join('\n')).toContain('site:amazonaws.com')
    expect(queries.join('\n').toLowerCase()).not.toContain('bruteforce')
  })

  it('parses source-stated resume sections into structured facts', () => {
    const facts = parseResumeFactsV40_4(`Jane Engineer\nEXPERIENCE\nSenior Linux Engineer — Acme Federal — 2022-present\nEDUCATION\nExample University — B.S. Computer Science\nCERTIFICATIONS\nRHCE\nSKILLS\nRHEL, Ansible, SELinux, Satellite\nhttps://github.com/jane`)
    expect(facts.some(fact => fact.factType === 'employment')).toBe(true)
    expect(facts.some(fact => fact.factType === 'education')).toBe(true)
    expect(facts.some(fact => fact.factType === 'certification')).toBe(true)
    expect(facts.some(fact => fact.factType === 'skill' && fact.value.name === 'RHEL')).toBe(true)
    expect(facts.some(fact => fact.factType === 'professional_url')).toBe(true)
  })

  it('requires exact name plus independent corroboration before unattended resume attachment', () => {
    const high = resumeIdentityConfidenceV40_4({
      text: 'Jane Engineer — Senior Linux Engineer — Acme Federal — Maryland — github.com/jane',
      candidate: { id: 'c1', canonical_name: 'Jane Engineer', current_company: 'Acme Federal', current_title: 'Senior Linux Engineer', location: 'Maryland' },
      profiles: [{ source: 'github', source_profile_id: 'jane', profile_url: 'https://github.com/jane' }],
    })
    expect(high.confidence).toBe('high')

    const weak = resumeIdentityConfidenceV40_4({
      text: 'Jane Engineer — generic biography',
      candidate: { id: 'c1', canonical_name: 'Jane Engineer' },
      profiles: [],
    })
    expect(weak.confidence).not.toBe('high')
  })

  it('redacts email and phone values before unattended resume persistence', () => {
    const safe = scrubUnattendedContactValuesV40_4('Jane Engineer jane@example.com +1 (555) 222-9191 RHEL engineer')
    expect(safe).toContain('[redacted-email]')
    expect(safe).toContain('[redacted-phone]')
    expect(safe).not.toContain('jane@example.com')
    expect(safe).not.toContain('555')
    const resume = read('lib/fleet/resume-intelligence-v40-4.ts')
    expect(resume).toContain('artifact.identityAnchors.observedEmails = []')
    expect(resume).toContain('contactValuesRedacted: true')
  })

  it('keeps public document acquisition bounded and blocks login/paywall bypass', () => {
    const resume = read('lib/fleet/resume-intelligence-v40-4.ts')
    expect(resume).toContain("'scribd.com'")
    expect(resume).toContain("status: restricted ? 'restricted_metadata_only' : 'discovered'")
    expect(resume).toContain('noAuthBypass')
    expect(resume).not.toContain('guessDrive')
    expect(resume).not.toContain('listObjectsV2')
    expect(resume).not.toContain('bypassPaywall')
  })

  it('uses an owner-scoped durable queue, provenance facts, novelty memory, and atomic task claims', () => {
    const migration = read('supabase/migrations/20260905011500_v40_4_enrichment_fleet.sql')
    expect(migration).toContain('create table if not exists public.candidate_enrichment_tasks')
    expect(migration).toContain('create table if not exists public.candidate_profile_facts')
    expect(migration).toContain('create table if not exists public.public_document_leads')
    expect(migration).toContain('create table if not exists public.fleet_seen_source_profiles')
    expect(migration).toContain('for update skip locked')
    expect(migration).toContain('claim_candidate_enrichment_tasks_v40_4')
    expect(migration).toContain('owner_id uuid not null')
  })

  it('retries transient enrichment failures and preserves existing skills', () => {
    const runtime = read('lib/fleet/enrichment-runtime-v40-4.ts')
    expect(runtime).toContain("status: 'queued'")
    expect(runtime).toContain('backoffMinutes')
    expect(runtime).toContain('preserveExistingSkills')
    expect(runtime).toContain('beforeSkills')
    expect(runtime).toContain('queryLimit: 2')
    expect(runtime).toContain('seedCandidateEnrichmentTasksV40_4(sb, 6)')
    expect(runtime).toContain('claimCandidateEnrichmentTasksV40_4(sb, 4')
  })

  it('keeps discovery and enrichment schedulers separately authenticated', () => {
    const config = JSON.parse(read('vercel.json'))
    expect(config.crons).toEqual([
      { path: '/api/cron/fleet/', schedule: '*/30 * * * *' },
      { path: '/api/cron/enrichment/', schedule: '*/15 * * * *' },
    ])
    const enrichment = read('app/api/cron/enrichment/route.ts')
    expect(enrichment).toContain('authorizeCronRequest(req)')
    expect(enrichment).toContain("auth !== 'authorized'")
    expect(enrichment).toContain('runEnrichmentTickV40_4(sb)')
  })
})
