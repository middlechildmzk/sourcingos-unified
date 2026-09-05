import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import {
  brightDataPayloadHasPublicUrlV36_16,
  brightDataSearchEngineForQueryV36_16,
  combineBrightDataSearchPayloadV36_16,
} from '@/lib/agent-data/brightdata-mcp-v36-16'

const root = path.resolve(process.cwd())
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8')

describe('V40.5d/V40.5e/V40.5f/V40.5g Bright Data search payloads', () => {
  it('keeps structured SERP links visible to downstream public URL discovery', () => {
    const combined = combineBrightDataSearchPayloadV36_16(
      'Search completed successfully.',
      {
        organic: [
          { link: 'https://example.edu/jane_resume.pdf', title: 'Jane Engineer Resume' },
          { link: 'https://docs.google.com/document/d/public-example', title: 'Jane Engineer CV' },
        ],
      },
    )
    expect(combined).toContain('Search completed successfully.')
    expect(combined).toContain('https://example.edu/jane_resume.pdf')
    expect(combined).toContain('https://docs.google.com/document/d/public-example')
    expect(brightDataPayloadHasPublicUrlV36_16(combined)).toBe(true)
    expect(brightDataPayloadHasPublicUrlV36_16('Search completed successfully.')).toBe(false)
  })

  it('routes resume/CV-shaped searches through Bing markdown while preserving Google for general research', () => {
    expect(brightDataSearchEngineForQueryV36_16('"Jane Engineer" resume filetype:pdf')).toBe('bing')
    expect(brightDataSearchEngineForQueryV36_16('"Jane Engineer" CV')).toBe('bing')
    expect(brightDataSearchEngineForQueryV36_16('"Jane Engineer" curriculum vitae')).toBe('bing')
    expect(brightDataSearchEngineForQueryV36_16('RHEL administrator Maryland')).toBe('google')
    expect(brightDataSearchEngineForQueryV36_16('"Jane Engineer" resume', 'yandex')).toBe('yandex')
  })

  it('uses the official Bright Data Discover REST API only as a bounded zero-URL Resume/CV fallback', () => {
    const adapter = read('lib/agent-data/brightdata-mcp-v36-16.ts')
    expect(adapter).toContain("const API_HOST = 'api.brightdata.com'")
    expect(adapter).toContain("const ALLOWED_TOOLS = ['search_engine', 'scrape_as_markdown']")
    expect(adapter).toContain('discoverPublicResumeLinksV36_16(clean)')
    expect(adapter).toContain("`https://${API_HOST}/discover`")
    expect(adapter).toContain("format: 'json'")
    expect(adapter).toContain('num_results: 10')
    expect(adapter).toContain("country: 'US'")
    expect(adapter).toContain("language: 'en'")
    expect(adapter).toContain('remove_duplicates: true')
    expect(adapter).toContain('already-public professional Resume/CV documents or portfolio pages')
    expect(adapter).not.toContain("tool: 'discover'")
  })

  it('bounds combined untrusted search content and does not change scrape-as-markdown behavior', () => {
    const combined = combineBrightDataSearchPayloadV36_16('x'.repeat(60_000), { link: 'https://example.com/resume.pdf' })
    expect(combined.length).toBe(50_000)
    const adapter = read('lib/agent-data/brightdata-mcp-v36-16.ts')
    expect(adapter).toContain('combineBrightDataSearchPayloadV36_16(result.text, result.structuredContent)')
    expect(adapter).toContain("tool: 'scrape_as_markdown'")
    expect(adapter).toContain('text: result.text')
    expect(adapter).toContain('arguments: { query: clean, engine }')
  })
})
