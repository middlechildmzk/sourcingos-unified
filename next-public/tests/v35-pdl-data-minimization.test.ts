import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const root = path.resolve(process.cwd())
const providerSource = fs.readFileSync(
  path.join(root, 'lib/contact-enrichment/providers/people-data-labs.ts'),
  'utf8',
)
const typesSource = fs.readFileSync(
  path.join(root, 'lib/contact-enrichment/types.ts'),
  'utf8',
)
const routeSource = fs.readFileSync(
  path.join(root, 'app/api/contact-enrichment/find/route.ts'),
  'utf8',
)

describe('V35 PDL privacy and identity-metadata contract', () => {
  it('requests an explicit bounded professional/contact allowlist', () => {
    expect(providerSource).toContain('PDL_DATA_INCLUDE_V35')
    expect(providerSource).toContain("'id'")
    expect(providerSource).toContain("'emails.address'")
    expect(providerSource).toContain("'phone_numbers'")
    expect(providerSource).toContain("'linkedin_url'")
    expect(providerSource).toContain("'github_url'")
    expect(providerSource).toContain("'job_company_website'")
    expect(providerSource).toContain("params.set('data_include', PDL_DATA_INCLUDE_V35.join(','))")
  })

  it('never opts into protected or unrelated sensitive provider fields', () => {
    const includeBlock = providerSource.match(/PDL_DATA_INCLUDE_V35 = \[(.*?)\] as const/s)?.[1] || ''
    expect(includeBlock).not.toMatch(/birth|gender|sex|ethnicity|race|religion|inferred_salary|interests|street_address/i)
  })

  it('keeps title out of provider identity matching and preserves a conservative threshold', () => {
    expect(providerSource).not.toContain("params.set('title', request.title)")
    expect(providerSource).toContain("params.set('min_likelihood', '6')")
    expect(providerSource).toContain("params.set('include_if_matched', 'true')")
  })

  it('preserves provider identity-match metadata without conflating it with contact verification', () => {
    expect(typesSource).toContain('export type ProviderMatchMetadata')
    expect(typesSource).toContain('providerPersonId?: string')
    expect(typesSource).toContain('providerScore?: number')
    expect(typesSource).toContain('matchedOn: string[]')
    expect(typesSource).toContain('ownershipConfidence')
    expect(typesSource).toContain('deliverability')
    expect(typesSource).toContain('permission')
    expect(providerSource).toContain("deliverability: 'unknown'")
  })

  it('returns normalized provider metadata and never a raw provider payload', () => {
    expect(routeSource).toContain('providerMatch: result.match')
    expect(routeSource).toContain('Contact ownership, deliverability, and permission are separate')
    expect(routeSource).not.toMatch(/rawProvider|providerPayload|rawPayload/)
  })
})
