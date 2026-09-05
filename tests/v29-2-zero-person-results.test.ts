import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

function read(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8')
}

describe('V29.2 zero-person candidate results', () => {
  it('separates supporting subjects from candidate people without presenting a blank dead end', () => {
    const source = read('components/WorkbenchResults.tsx')

    expect(source).toContain("const hasPeople = people.length > 0")
    expect(source).toContain("'No candidate people found'")
    expect(source).toContain('No people matched this search yet')
    expect(source).toContain('supporting source')
    expect(source).toContain('Open public-resume X-Ray')
    expect(source).toContain('Search Candidate Database')
    expect(source).toContain('Supporting evidence and discovery results')
    expect(source).toContain('These are not candidate people.')
  })

  it('keeps candidate-only controls out of the zero-person state', () => {
    const source = read('components/WorkbenchResults.tsx')

    expect(source).toContain('{hasPeople && (\n        <div className="recruiter-results-toolbar">')
    expect(source).toContain('{hasPeople && (\n        <div className="recruiter-trust-note">')
    expect(source).toContain('{!hasPeople && (\n        <section')
  })
})
