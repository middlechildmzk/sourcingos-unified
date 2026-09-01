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

describe('V34 PDL privacy/data-minimization hardening', () => {
  it('requests only the fields the adapter maps instead of the full PDL person record', () => {
    expect(providerSource).toContain("'id'")
    expect(providerSource).toContain("'emails.address'")
    expect(providerSource).toContain("'phone_numbers'")
    expect(providerSource).toContain("'linkedin_url'")
    expect(providerSource).toContain("'github_url'")
    expect(providerSource).toContain("'job_company_website'")
    expect(providerSource).toContain("params.set('data_include', PDL_DATA_INCLUDE)")
  })

  it('asks PDL which identity inputs matched without logging their values', () => {
    expect(providerSource).toContain("params.set('include_if_matched', 'true')")
    expect(providerSource).toContain('providerMatchedFields')
    expect(typesSource).toContain('providerMatchedFields?: string[]')
    expect(typesSource).toContain('Names of request inputs the provider says matched')
  })

  it('preserves PDL person id and likelihood as provider identity metadata, not contact verification', () => {
    expect(providerSource).toContain('providerRecordId')
    expect(providerSource).toContain('providerMatchLikelihood')
    expect(typesSource).toContain('providerMatchLikelihood?: number')
    expect(typesSource).toContain('This is NOT contact verification')
    expect(providerSource).toContain("verified=false")
  })

  it('returns only safe provider provenance through the route, not a raw provider payload', () => {
    expect(routeSource).toContain('providerRecordId: result.log.providerRecordId')
    expect(routeSource).toContain('providerMatchLikelihood: result.log.providerMatchLikelihood')
    expect(routeSource).toContain('providerMatchedFields: result.log.providerMatchedFields')
    expect(routeSource).toContain('Never raw matched values/payloads')
    expect(routeSource).not.toMatch(/rawProvider|providerPayload|rawPayload/)
  })

  it('does not send job title as an undocumented Person Enrichment match parameter', () => {
    expect(providerSource).not.toContain("params.set('title', request.title)")
    expect(providerSource).toContain('does not document title as a match input')
  })

  it('keeps the conservative high-accuracy identity threshold', () => {
    expect(providerSource).toContain("params.set('min_likelihood', '6')")
  })

  it('never opts into protected or sensitive PDL fields', () => {
    const includeBlock = providerSource.match(/const PDL_DATA_INCLUDE = \[(.*?)\]\.join\(','\)/s)?.[1] || ''
    expect(includeBlock).not.toMatch(/birth|gender|sex|ethnicity|race|religion|inferred_salary|interests/i)
  })
})
