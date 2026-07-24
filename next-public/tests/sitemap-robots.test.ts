// tests/sitemap-robots.test.ts — Public SEO surface is complete; private
// surfaces never leak into the sitemap; robots blocks every private surface.
import { describe, it, expect } from 'vitest'
import sitemap from '../app/sitemap'
import robots from '../app/robots'
import { siteUrl } from '../lib/site'

describe('sitemap', () => {
  const entries = sitemap()
  const urls = entries.map(e => e.url)

  it('includes the flagship demo, tools, trust/company pages, and training hub', () => {
    for (const path of [
      '/candidate-search/',
      '/tools/search-lane-expander/',
      '/directory/',
      '/directory/contactout/',
      '/directory/lusha/',
      '/directory/apollo/',
      '/directory/google-dorks/',
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

  it('never includes private, auth, or API surfaces', () => {
    for (const bad of ['/app', '/admin', '/login', '/jobs/admin', '/auth/', '/api/']) {
      expect(urls.some(u => u.includes(bad))).toBe(false)
    }
  })

  it('only emits canonical-domain URLs', () => {
    expect(urls.every(u => u.startsWith('https://www.getsourcingos.com'))).toBe(true)
  })

  it('uses stable sitemap metadata instead of every entry using runtime now', () => {
    expect(entries.every(e => e.lastModified instanceof Date)).toBe(true)
    expect(entries.some(e => e.priority === 1)).toBe(true)
    expect(entries.some(e => e.changeFrequency === 'weekly')).toBe(true)
  })
})

describe('robots', () => {
  it('disallows every private surface including auth, API, and jobs admin', () => {
    const r = robots()
    const rules = Array.isArray(r.rules) ? r.rules : [r.rules]
    const disallow = rules.flatMap(rule => {
      const d = (rule as { disallow?: string | string[] }).disallow
      return Array.isArray(d) ? d : d ? [d] : []
    })
    for (const path of ['/admin/', '/app/', '/login/', '/auth/', '/api/', '/jobs/admin/']) {
      expect(disallow).toContain(path)
    }
  })

  it('keeps public education/tool pages available to AI crawlers while blocking private surfaces', () => {
    const r = robots()
    const rules = Array.isArray(r.rules) ? r.rules : [r.rules]
    const aiRule = rules.find(rule => (rule as { userAgent?: string }).userAgent === 'GPTBot') as { allow?: string | string[]; disallow?: string | string[] } | undefined
    expect(aiRule).toBeTruthy()
    expect(aiRule?.allow).toContain('/methodology/')
    expect(aiRule?.allow).toContain('/tools/')
    expect(aiRule?.disallow).toContain('/api/')
  })
})
