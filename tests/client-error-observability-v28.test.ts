import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(__dirname, '..')
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8')

const reporter = read('components/ClientErrorReporter.tsx')
const endpoint = read('app/api/client-errors/route.ts')
const layout = read('app/app/layout.tsx')

describe('V28 redacted client error observability', () => {
  it('captures browser errors and unhandled rejections only inside the private app', () => {
    expect(reporter).toContain("window.addEventListener('error'")
    expect(reporter).toContain("window.addEventListener('unhandledrejection'")
    expect(layout).toContain('<ClientErrorReporter />')
    expect(layout).toContain("import { ClientErrorReporter }")
  })

  it('redacts high-risk values before transport and again on the server', () => {
    for (const source of [reporter, endpoint]) {
      expect(source).toContain('[redacted-email]')
      expect(source).toContain('[redacted-url]')
      expect(source).toContain('[redacted-id]')
      expect(source).toContain('[redacted-phone]')
      expect(source).toContain('[redacted-token]')
    }
  })

  it('keeps telemetry authenticated, rate-limited, bounded, and free of user identity fields', () => {
    expect(endpoint).toContain('requireSession()')
    expect(endpoint).toContain("rateLimit(req, 'workbench', gate.userId)")
    expect(endpoint).toContain('z.string().max(2500)')
    expect(endpoint).toContain('[SourcingOSClientError]')
    expect(endpoint).not.toContain('gate.userId,')
    expect(endpoint).not.toContain('userEmail')
  })
})
