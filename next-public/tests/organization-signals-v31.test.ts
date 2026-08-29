import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  dedupeOrganizationSignals,
  memoryDisposition,
  organizationSignalFingerprint,
  publicSignalQuery,
  signalFreshnessDays,
  updateSignalMemory,
  type OrganizationSignal,
} from '../lib/organization-signals-v31'

const signal: OrganizationSignal = {
  id: 'usaspending:award-1:example-corp',
  source: 'usaspending',
  kind: 'contract_award',
  organization: 'Example Corp',
  headline: 'Federal contract award · Example Agency',
  whyNow: 'Public award matched the role search terms.',
  sourceUrl: 'https://www.usaspending.gov/award/example/',
  sourceRecordId: 'AWARD-1',
  agency: 'Example Agency',
  amount: 12_000_000,
  eventDate: '2026-08-01T00:00:00.000Z',
  observedAt: '2026-08-29T00:00:00.000Z',
}

describe('V31 organization signal intelligence', () => {
  it('removes sensitive clearance/citizenship language from external market-signal queries', () => {
    const query = publicSignalQuery({
      title: 'Secret Cleared Federal Program Manager',
      mustHaves: ['program management', 'TS/SCI', 'US citizenship', 'cloud modernization'],
    })
    expect(query).toMatch(/program management/i)
    expect(query).toMatch(/cloud modernization/i)
    expect(query).not.toMatch(/secret/i)
    expect(query).not.toMatch(/ts\/?sci/i)
    expect(query).not.toMatch(/citizen/i)
  })

  it('dedupes and remembers organization events without candidate semantics', () => {
    expect(dedupeOrganizationSignals([signal, { ...signal }])).toHaveLength(1)
    expect(organizationSignalFingerprint(signal)).toContain('usaspending')
    const memory = updateSignalMemory([], signal, 'targeted', '2026-08-29T12:00:00.000Z')
    expect(memoryDisposition(memory, signal)).toBe('targeted')
    expect(memory[0]).not.toHaveProperty('candidateId')
  })

  it('calculates signal freshness from the public event date', () => {
    expect(signalFreshnessDays('2026-08-01T00:00:00.000Z', new Date('2026-08-29T00:00:00.000Z'))).toBe(28)
  })

  it('uses the official USAspending contract-award endpoint with organization-level fields', () => {
    const source = readFileSync(
      fileURLToPath(new URL('../lib/usaspending-signals-v31.ts', import.meta.url)),
      'utf8',
    )
    expect(source).toContain("const USASPENDING_ORIGIN = 'https://api.usaspending.gov'")
    expect(source).toContain('/api/v2/search/spending_by_award/')
    expect(source).toContain("award_type_codes: CONTRACT_AWARD_TYPES")
    expect(source).toContain("'Recipient Name'")
    expect(source).toContain("kind: 'contract_award'")
    expect(source).not.toContain("kind: 'contract_loss'")
    expect(source).not.toContain("kind: 'recompete'")
  })

  it('keeps the organization-signal API authenticated, rate-limited, read-only, and candidate-free', () => {
    const route = readFileSync(
      fileURLToPath(new URL('../app/api/organization-signals/route.ts', import.meta.url)),
      'utf8',
    )
    expect(route).toContain('requireSession()')
    expect(route).toContain("rateLimit(req, 'workbench'")
    expect(route).toContain("execution: 'read_only_preview'")
    expect(route).toContain('They do not create, rank, or modify candidates')
    expect(route).not.toContain("from('candidates')")
    expect(route).not.toContain('candidateId')
  })

  it('requires an explicit recruiter action before a signal changes role targeting', () => {
    const component = readFileSync(
      fileURLToPath(new URL('../components/RoleOrganizationSignals.tsx', import.meta.url)),
      'utf8',
    )
    expect(component).toContain("targetCompanies: [...current.intake.targetCompanies, signal.organization]")
    expect(component).toContain("type: 'note_added'")
    expect(component).toContain('Add organization')
    expect(component).toContain('Dismiss')
    expect(component).not.toContain('candidates: [')
    expect(component).not.toContain('addCanonicalCandidateToRole')
  })

  it('surfaces organization signals only inside the agentic role workspace', () => {
    const page = readFileSync(
      fileURLToPath(new URL('../app/app/agentic-sourcing/[id]/page.tsx', import.meta.url)),
      'utf8',
    )
    expect(page).toContain('RoleOrganizationSignals')
    expect(page).toContain('<RoleOrganizationSignals roleId={id} />')
  })
})
