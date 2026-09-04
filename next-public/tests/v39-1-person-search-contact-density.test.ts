import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

const read = (relative: string) => fs.readFileSync(path.join(process.cwd(), relative), 'utf8')

describe('V39.1 recruiter search regression guard', () => {
  it('automatically falls through to live sources after a zero-match Candidate Graph lookup', () => {
    const source = read('components/PersonLookupV38_4.tsx')
    expect(source).toContain('if (candidates.length === 0) await searchLiveForValue(value)')
    expect(source).toContain("'Find person'")
    expect(source).toContain('Live sources are checked automatically.')
  })

  it('does not render repetitive Email Unknown / Phone Unknown rows when contact has not been checked', () => {
    const source = read('components/CandidateRow.tsx')
    expect(source).toContain('Contact not checked')
    expect(source).toContain("email.text !== 'Unknown'")
    expect(source).toContain("phone.text !== 'Unknown'")
  })

  it('keeps the candidate list readable while moving Candidate 360 to a laptop-width slide-over', () => {
    const moduleCss = read('components/SearchWorkspaceV38_1.module.css')
    expect(moduleCss).toContain('minmax(680px,1fr)')
    expect(moduleCss).toContain("@media(min-width:901px) and (max-width:1699px)")
    expect(moduleCss).toContain('grid-template-columns:minmax(280px,320px) minmax(0,1fr)')
    expect(moduleCss).toContain(':global(.search-workspace-right.has-selection){transform:translateX(0)')
    expect(moduleCss).toContain(':global(.candidate-row-name-line strong){font-size:14px')
    expect(moduleCss).toContain(':global(.candidate-row){grid-template-columns:32px minmax(0,1fr) 118px')
  })
})
