import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = process.cwd()
const read = (relativePath: string) => readFileSync(join(root, relativePath), 'utf8')

const listRoute = read('app/api/identity/proposals/route.ts')
const detailRoute = read('app/api/identity/proposals/[id]/route.ts')
const proposalRead = read('lib/identity/proposal-read.ts')
const client = read('components/IdentityReviewClient.tsx')
const candidateDb = read('components/CandidateDbClient.tsx')
const page = read('app/app/identity-review/page.tsx')

describe('V29.3A2 read-only API boundary', () => {
  it('exposes GET-only proposal list and detail routes', () => {
    expect(listRoute).toContain('export async function GET')
    expect(detailRoute).toContain('export async function GET')
    expect(listRoute).not.toContain('export async function POST')
    expect(detailRoute).not.toContain('export async function POST')
  })

  it('requires authentication and owner-scoped rate limiting', () => {
    for (const route of [listRoute, detailRoute]) {
      expect(route).toContain('requireSession()')
      expect(route).toContain("rateLimit(request, 'workbench', gate.userId)")
    }
  })

  it('validates bounded list queries and UUID detail IDs', () => {
    expect(listRoute).toContain('.int().min(1).max(100)')
    expect(listRoute).toContain("z.enum(['pending', 'approved', 'rejected', 'auto_attached_deterministic', 'superseded'])")
    expect(detailRoute).toContain('z.string().uuid()')
  })

  it('fails gracefully when identity schema is unavailable', () => {
    for (const route of [listRoute, detailRoute]) {
      expect(route).toContain("code: 'identity_schema_unavailable'")
      expect(route).toContain('available: false')
      expect(route).toContain('gate.preview || !isSupabaseConfigured()')
    }
    expect(proposalRead).toContain("code === '42P01'")
    expect(proposalRead).toContain("code === 'PGRST205'")
  })

  it('contains no proposal mutation call', () => {
    expect(proposalRead).not.toMatch(/\.insert\s*\(/)
    expect(proposalRead).not.toMatch(/\.update\s*\(/)
    expect(proposalRead).not.toMatch(/\.delete\s*\(/)
    expect(listRoute).not.toMatch(/\.insert\s*\(|\.update\s*\(|\.delete\s*\(/)
    expect(detailRoute).not.toMatch(/\.insert\s*\(|\.update\s*\(|\.delete\s*\(/)
  })
})

describe('V29.3A2 owner scoping and browser data minimization', () => {
  it('owner-scopes every durable proposal table read', () => {
    for (const table of [
      'identity_match_proposals',
      'source_profiles',
      'candidates',
      'source_profile_identifiers',
      'evidence_claims',
      'source_profile_snapshots',
    ]) {
      const tableReads = proposalRead.split(`from('${table}')`).slice(1)
      expect(tableReads.length, `expected read for ${table}`).toBeGreaterThan(0)
      for (const tableRead of tableReads) {
        expect(tableRead.split("from('", 1)[0], `missing owner filter after ${table}`).toContain(".eq('owner_id', ownerId)")
      }
    }
  })

  it('never reads raw source-profile snapshot payloads', () => {
    expect(proposalRead).not.toContain('raw_payload')
    expect(proposalRead).not.toContain('normalized_payload')
    expect(proposalRead).toContain("from('source_profile_snapshots').select('id', { count: 'exact', head: true })")
  })

  it('does not return identifier hashes to the browser', () => {
    expect(proposalRead).not.toContain('normalized_value_hash')
    expect(proposalRead).toContain("displayValue: sensitive ? null")
    expect(client).toContain('Sensitive value masked in browser')
  })

  it('masks contact-like field claims in the route payload', () => {
    expect(detailRoute).toContain('SENSITIVE_FIELD')
    expect(detailRoute).toContain("value: '[Sensitive claim masked]' ")
    expect(detailRoute).toContain('normalizedValue: null')
  })

  it('never logs proposal payloads or sensitive values', () => {
    expect(proposalRead).not.toContain('console.')
    expect(listRoute).not.toContain('console.')
    expect(detailRoute).not.toContain('console.')
  })
})

describe('V29.3A2 recruiter review UX', () => {
  it('labels scores as review rank rather than identity confidence', () => {
    expect(client).toContain('Review rank')
    expect(client).toContain('Ranking signal, not probability')
    expect(client).not.toContain('confidence percentage')
  })

  it('shows deterministic rules, similarity components, and conflicts together', () => {
    expect(client).toContain('Deterministic anchors')
    expect(client).toContain('Similarity components')
    expect(client).toContain('Conflicts and negative evidence')
  })

  it('contains no approve, reject, attach, or merge action', () => {
    expect(client).not.toContain('Confirm match')
    expect(client).not.toContain('Keep separate')
    expect(client).not.toContain('Approve match')
    expect(client).not.toMatch(/method:\s*['"]POST['"]/)
    expect(client).toContain('Decision controls are intentionally unavailable')
  })

  it('gives a safe not-activated state without implying failure or data loss', () => {
    expect(client).toContain('Durable identity review is unavailable')
    expect(client).toContain('No proposal, candidate, source-profile, or database record was changed')
  })

  it('keeps the page authenticated-only and out of search indexes', () => {
    expect(page).toContain("robots: { index: false, follow: false }")
    expect(page).toContain('<IdentityReviewClient />')
  })
})

describe('V29.3A2 Candidate Database handoff', () => {
  it('removes legacy client-authored match creation and decisions', () => {
    expect(candidateDb).not.toContain('/api/candidate-db/match-review')
    expect(candidateDb).not.toContain('/api/candidate-db/confirm-merge')
    expect(candidateDb).not.toContain('Confirm match')
    expect(candidateDb).not.toContain('Keep separate')
  })

  it('preserves legacy reviews as read-only history', () => {
    expect(candidateDb).toContain('Earlier identity reviews')
    expect(candidateDb).toContain('read only')
    expect(candidateDb).toContain('Use the durable proposal surface')
  })

  it('links Candidate Database to the durable review page', () => {
    expect((candidateDb.match(/href="\/app\/identity-review"/g) || []).length).toBeGreaterThanOrEqual(2)
  })
})

describe('V29.3A2 release boundary', () => {
  it('adds no new migration beyond the baseline and identity foundation', () => {
    const migrations = readdirSync(join(root, 'supabase/migrations')).filter(file => file.endsWith('.sql')).sort()
    expect(migrations).toEqual([
      '20260730172500_canonical_baseline_anchor.sql',
      '20260730181000_durable_identity_foundation.sql',
    ])
  })

  it('contains the new read surface files', () => {
    for (const path of [
      'app/api/identity/proposals/route.ts',
      'app/api/identity/proposals/[id]/route.ts',
      'app/app/identity-review/page.tsx',
      'components/IdentityReviewClient.tsx',
      'lib/identity/proposal-read.ts',
    ]) expect(existsSync(join(root, path)), path).toBe(true)
  })
})
