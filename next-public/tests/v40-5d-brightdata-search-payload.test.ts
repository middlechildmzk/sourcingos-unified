import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { combineBrightDataSearchPayloadV36_16 } from '@/lib/agent-data/brightdata-mcp-v36-16'

const root = path.resolve(process.cwd())
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8')

describe('V40.5d Bright Data structured search payloads', () => {
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
  })

  it('bounds combined untrusted search content and does not change scrape-as-markdown behavior', () => {
    const combined = combineBrightDataSearchPayloadV36_16('x'.repeat(60_000), { link: 'https://example.com/resume.pdf' })
    expect(combined.length).toBe(50_000)
    const adapter = read('lib/agent-data/brightdata-mcp-v36-16.ts')
    expect(adapter).toContain('combineBrightDataSearchPayloadV36_16(result.text, result.structuredContent)')
    expect(adapter).toContain("tool: 'scrape_as_markdown'")
    expect(adapter).toContain('text: result.text')
  })
})
