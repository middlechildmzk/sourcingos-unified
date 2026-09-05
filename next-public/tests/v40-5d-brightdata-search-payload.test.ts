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

describe('V40.5 Bright Data search payloads', () => {
  it('keeps structured SERP links visible to downstream public URL discovery', () => {
    const combined = combineBrightDataSearchPayloadV36_16('Search completed successfully.', {
      organic: [
        { link: 'https://example.edu/jane_resume.pdf', title: 'Jane Engineer Resume' },
        { link: 'https://docs.google.com/document/d/public-example', title: 'Jane Engineer CV' },
      ],
    })
    expect(combined).toContain('https://example.edu/jane_resume.pdf')
    expect(combined).toContain('https://docs.google.com/document/d/public-example')
    expect(brightDataPayloadHasPublicUrlV36_16(combined)).toBe(true)
    expect(brightDataPayloadHasPublicUrlV36_16('Search completed successfully.')).toBe(false)
  })

  it('routes resume/CV-shaped searches through Bing while preserving Google for general research', () => {
    expect(brightDataSearchEngineForQueryV36_16('"Jane Engineer" resume filetype:pdf')).toBe('bing')
    expect(brightDataSearchEngineForQueryV36_16('"Jane Engineer" CV')).toBe('bing')
    expect(brightDataSearchEngineForQueryV36_16('RHEL administrator Maryland')).toBe('google')
    expect(brightDataSearchEngineForQueryV36_16('"Jane Engineer" resume', 'yandex')).toBe('yandex')
  })

  it('uses the current official SERP REST API as the bounded zero-URL Resume/CV fallback', () => {
    const adapter = read('lib/agent-data/brightdata-mcp-v36-16.ts')
    expect(adapter).toContain("const API_HOST = 'api.brightdata.com'")
    expect(adapter).toContain("`https://${API_HOST}/zone/get_active_zones`")
    expect(adapter).toContain("row?.type === 'serp'")
    expect(adapter).toContain('process.env.BRIGHTDATA_SERP_ZONE')
    expect(adapter).toContain('searchPublicResumeLinksWithSerpApiV36_16(clean)')
    expect(adapter).toContain("`https://${API_HOST}/request`")
    expect(adapter).toContain("search_engine: 'bing'")
    expect(adapter).toContain("data_format: 'parsed_bing_api'")
    expect(adapter).toContain("format: 'json'")
    expect(adapter).not.toContain('/discover')
    expect(adapter).not.toContain("tool: 'discover'")
  })

  it('bounds combined untrusted search content and does not change scrape-as-markdown behavior', () => {
    const combined = combineBrightDataSearchPayloadV36_16('x'.repeat(60_000), { link: 'https://example.com/resume.pdf' })
    expect(combined.length).toBe(50_000)
    const adapter = read('lib/agent-data/brightdata-mcp-v36-16.ts')
    expect(adapter).toContain('combineBrightDataSearchPayloadV36_16(result.text, result.structuredContent)')
    expect(adapter).toContain("tool: 'scrape_as_markdown'")
    expect(adapter).toContain('arguments: { query: clean, engine }')
  })
})
