import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

describe('V35 provider metadata and trust contract', () => {
  it('asks PDL for match metadata while retaining the conservative likelihood floor', () => {
    const source = readFileSync(
      fileURLToPath(new URL('../lib/contact-enrichment/providers/people-data-labs.ts', import.meta.url)),
      'utf8',
    )

    expect(source).toContain("params.set('min_likelihood', '6')")
    expect(source).toContain("params.set('include_if_matched', 'true')")
    expect(source).toContain('providerPersonId')
    expect(source).toContain('matchedOn')
    expect(source).toContain('ownershipConfidence')
    expect(source).toContain("deliverability: 'unknown'")
  })

  it('keeps identity readiness before provider execution and exposes only normalized match metadata', () => {
    const route = readFileSync(
      fileURLToPath(new URL('../app/api/contact-enrichment/find/route.ts', import.meta.url)),
      'utf8',
    )

    const gateCall = route.indexOf('assessEnrichmentIdentityV34(request)')
    const orchestratorCall = route.indexOf('runContactEnrichmentOrchestratorV35({')
    expect(gateCall).toBeGreaterThan(-1)
    expect(orchestratorCall).toBeGreaterThan(-1)
    expect(gateCall).toBeLessThan(orchestratorCall)
    expect(route).toContain('providerMatch: result.match')
    expect(route).toContain('ownership, deliverability, and permission are separate')
    expect(route).not.toMatch(/NEXT_PUBLIC_.*PDL/i)
  })

  it('persists replay-safe contact-channel metadata without promoting provider match metadata into identity authority', () => {
    const route = readFileSync(
      fileURLToPath(new URL('../app/api/contact-enrichment/find/route.ts', import.meta.url)),
      'utf8',
    )

    expect(route).not.toContain('provider_person_id:')
    expect(route).toContain('ownership_confidence:')
    expect(route).toContain('deliverability:')
    expect(route).toContain('provider_status_raw:')
    // Permission metadata must survive persistence. Default unknown remains the
    // fallback, but explicit provider DNC cannot be erased on write.
    expect(route).toContain("permission_status: s.permissionStatus || 'unknown'")
  })

  it('keeps the Candidate 360 resolver read-only and shadow-labeled at the API seam', () => {
    const route = readFileSync(
      fileURLToPath(new URL('../app/api/role-candidate-assessment/route.ts', import.meta.url)),
      'utf8',
    )

    expect(route).toContain('resolveCandidate360FieldsV35(snapshot, ledger, candidateId)')
    expect(route).toContain('profileResolutionShadow')
    expect(route).toContain('shadowOnly: true')
    expect(route).toContain('no scalar value is silently overwritten')
  })
})
