import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), 'utf8')
}

describe('post-V37 public authority hygiene', () => {
  it('publishes a current llms.txt with the canonical recruiter architecture and trust boundaries', () => {
    const llms = source('public/llms.txt')
    expect(llms).toContain('Today')
    expect(llms).toContain('Roles')
    expect(llms).toContain('People Search')
    expect(llms).toContain('Talent')
    expect(llms).toContain('Sources')
    expect(llms).toContain('Search expansion is not candidate evidence.')
    expect(llms).toContain('Provider retrieval is not qualification.')
    expect(llms).toContain('Missing evidence is not negative evidence.')
    expect(llms).toContain('https://www.getsourcingos.com/sitemap.xml')
  })

  it('keeps private product surfaces explicitly described as private', () => {
    const llms = source('public/llms.txt')
    expect(llms).toContain('Authenticated app, admin, API, and account surfaces are private')
    expect(llms).not.toContain('API_KEY')
    expect(llms).not.toContain('SUPABASE_SERVICE_ROLE_KEY')
    expect(llms).not.toContain('CRON_SECRET')
  })

  it('renders Organization and WebSite structured data from the root public layout', () => {
    const structured = source('components/SiteStructuredData.tsx')
    const layout = source('app/layout.tsx')
    expect(structured).toContain("'@type': 'Organization'")
    expect(structured).toContain("'@type': 'WebSite'")
    expect(layout).toContain('<SourcingOSOrganizationJsonLd />')
    expect(layout).toContain('<SourcingOSWebsiteJsonLd />')
  })
})
