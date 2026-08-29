import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const route = readFileSync(
  fileURLToPath(new URL('../app/api/contact/route.ts', import.meta.url)),
  'utf8',
)

describe('contact route trust boundary', () => {
  it('rate limits before parsing or persistence', () => {
    const rateLimitIndex = route.indexOf("rateLimit(req, 'contact')")
    const parseIndex = route.indexOf('contactRequestSchema.safeParse')
    const insertIndex = route.indexOf("from('contact_requests').insert")

    expect(rateLimitIndex).toBeGreaterThan(-1)
    expect(parseIndex).toBeGreaterThan(rateLimitIndex)
    expect(insertIndex).toBeGreaterThan(parseIndex)
  })

  it('does not log submitted request contents', () => {
    expect(route).not.toContain('console.log')
    expect(route).not.toContain('console.info')
  })
})
