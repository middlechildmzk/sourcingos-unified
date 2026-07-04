// tests/sitemap-robots.test.ts — Public SEO surface is complete; private
// surfaces never leak into the sitemap; robots blocks every admin surface.
import { describe, it, expect } from 'vitest'
import sitemap from '../app/sitemap'
import robots from '../app/robots'
import { siteUrl } from '../lib/site'

describe('sitemap', () => {
  const urls = sitemap().map(e => e.url)

  it('includes the flagship demo, tools, trust/company pages, and training hub', () => {
    for (const path of [
      '/candidate-search/',
      '/tools/search-lane-expander/',
      '/about/',
      '/methodology/',
      '/training/',
      '/training/ai-sourcing-prompts/',
      '/training/evidence-review-checklist/',
      '/training/hiring-manager-calibration-workshop/',
      '/training/cleared-govcon-sourcing-safety/',
      '/training/candidate-360-workshop/',
      '/trust/',
      '/data-sources/',
      '/terms/',
      '/contact/',
      '/privacy/',
      '/waitlist/',
    ]) {
      expect(urls).toContain(siteUrl + path)
    }
  })

  it('never includes private or auth surfaces', () => {
    for (const bad of ['/app', '/admin', '/login', '/jobs/admin', '/auth/']) {
      expect(urls.some(u => u.includes(bad))).toBe(false)
    }
  })

  it('only emits canonical-domain URLs', () => {
    expect(urls.every(u => u.startsWith('https://www.getsourcingos.com'))).toBe(true)
  })
})

describe('robots', () => {
  it('disallows every private surface including jobs admin', () => {
    const r = robots()
    const rules = Array.isArray(r.rules) ? r.rules : [r.rules]
    const disallow = rules.flatMap(rule => {
      const d = (rule as { disallow?: string | string[] }).disallow
      return Array.isArray(d) ? d : d ? [d] : []
    })
    for (const path of ['/admin/', '/app/', '/login/', '/jobs/admin/']) {
      expect(disallow).toContain(path)
    }
  })
})
