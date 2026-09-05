import { describe, expect, it } from 'vitest'
import { firecrawlMarkdownFromPayloadV40_5I } from '@/lib/agent-data/brightdata-mcp-v36-16'
import { publicDeepRefreshUrlV36_16 } from '@/lib/agent-data/public-web-policy-v36-16'

describe('V40.5i public document Firecrawl fallback', () => {
  it('extracts bounded markdown from a v2 scrape response', () => {
    expect(firecrawlMarkdownFromPayloadV40_5I({
      success: true,
      data: { markdown: '# Jane Candidate\n\nProfessional Experience' },
    })).toBe('# Jane Candidate\n\nProfessional Experience')
  })

  it('returns empty text for malformed responses instead of inventing content', () => {
    expect(firecrawlMarkdownFromPayloadV40_5I({ success: true, data: {} })).toBe('')
    expect(firecrawlMarkdownFromPayloadV40_5I(null)).toBe('')
  })

  it('keeps the existing public URL gate in front of fallback retrieval', () => {
    expect(() => publicDeepRefreshUrlV36_16('http://127.0.0.1/resume.pdf')).toThrow(/Private or local/)
    expect(() => publicDeepRefreshUrlV36_16('https://www.linkedin.com/in/example')).toThrow(/Deep refresh is not allowed/)
    expect(publicDeepRefreshUrlV36_16('https://example.edu/resume.pdf')).toBe('https://example.edu/resume.pdf')
  })
})
