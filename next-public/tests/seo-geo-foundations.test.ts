import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

function read(path: string) {
  return readFileSync(join(process.cwd(), path), 'utf8')
}

describe('SEO and GEO foundations', () => {
  it('ships an llms.txt with SourcingOS trust boundaries and key pages', () => {
    const llms = read('public/llms.txt')
    expect(llms).toContain('SourcingOS')
    expect(llms).toContain('Does not generate fake candidates')
    expect(llms).toContain('Does not scrape LinkedIn')
    expect(llms).toContain('Confidence means source relevance only')
    expect(llms).toContain('https://www.getsourcingos.com/methodology/')
    expect(llms).toContain('https://www.getsourcingos.com/tools/search-lane-expander/')
  })

  it('adds global structured data and a skip link', () => {
    const layout = read('app/layout.tsx')
    expect(layout).toContain('OrganizationJsonLd')
    expect(layout).toContain('WebsiteJsonLd')
    expect(layout).toContain('Skip to content')
    expect(layout).toContain('main-content')
  })

  it('adds FAQ schema and answer-first TLDR blocks to trust, methodology, and data sources pages', () => {
    for (const path of ['app/trust/page.tsx', 'app/methodology/page.tsx', 'app/data-sources/page.tsx']) {
      const page = read(path)
      expect(page).toContain('FaqJsonLd')
      expect(page).toContain('TL;DR')
      expect(page).toContain('<h2>FAQ</h2>')
    }
  })

  it('adds HowTo schema to the Search Lane Expander tool', () => {
    const page = read('app/tools/search-lane-expander/page.tsx')
    expect(page).toContain('HowToJsonLd')
    expect(page).toContain('How to expand a sourcing search lane')
  })

  it('defines a typed analytics event scaffold for the launch funnel', () => {
    const analytics = read('lib/analytics.ts')
    for (const eventName of [
      'candidate_search_started',
      'candidate_search_mode_selected',
      'manual_safe_lane_opened',
      'evidence_drawer_opened',
      'gated_action_clicked',
      'waitlist_submitted',
      'tool_used',
    ]) {
      expect(analytics).toContain(eventName)
    }
  })
})
