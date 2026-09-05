import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(join(process.cwd(), 'app/app/candidate-database/error.tsx'), 'utf8')

describe('Candidate Database recovery boundary', () => {
  it('does not expose raw runtime errors or unsupported persistence assurances', () => {
    expect(source).not.toContain('error.message')
    expect(source).not.toMatch(/safe on the server/i)
  })

  it('provides retry and safe navigation using existing button classes', () => {
    expect(source).toContain('onClick={reset}')
    expect(source).toContain('className="btn secondary"')
    expect(source).toContain('/app/candidate-database')
    expect(source).toContain('/app/roles')
  })
})
