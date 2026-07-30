import { describe, expect, it } from 'vitest'
import { cleanText, hasUsefulSnippet, safeJobSnippet } from '../lib/jobs-ingestion'

describe('live jobs snippet cleanup', () => {
  it('decodes common HTML entities and strips tags', () => {
    const cleaned = cleanText('<p>Recruiter&nbsp;&amp;&nbsp;Sourcer &mdash; remote</p>')
    expect(cleaned).toBe('Recruiter & Sourcer remote')
  })

  it('falls back when a snippet is mostly markup or junk', () => {
    expect(hasUsefulSnippet('{} [] <div></div> null undefined')).toBe(false)
    expect(safeJobSnippet('{} [] <div></div> null undefined')).toBe('View the original posting for full job details.')
  })

  it('keeps useful recruiter job snippets', () => {
    const snippet = 'The technical sourcer will partner with hiring managers, build search strategies, and support engineering roles across the organization.'
    expect(hasUsefulSnippet(snippet)).toBe(true)
    expect(safeJobSnippet(snippet)).toContain('technical sourcer')
  })
})
