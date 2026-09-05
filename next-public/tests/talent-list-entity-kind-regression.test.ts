import { describe, expect, it } from 'vitest'
import { candidateWorkspaceEntityKindV41 } from '@/lib/candidate-workspace-v25'

describe('Talent list stored-candidate entity classification', () => {
  it('keeps an explicit person classification', () => {
    expect(candidateWorkspaceEntityKindV41([{ source: 'github', raw: {}, entity_kind: 'person' }])).toBe('person')
  })

  it('treats a legacy stored candidate with a profile but no entity_kind as a person', () => {
    expect(candidateWorkspaceEntityKindV41([{ source: 'csv_import', raw: {}, entity_kind: null }])).toBe('person')
  })

  it('does not override an explicit non-person classification', () => {
    expect(candidateWorkspaceEntityKindV41([{ source: 'public_web', raw: {}, entity_kind: 'organization' }])).toBe('organization')
  })

  it('keeps an empty profile set unknown', () => {
    expect(candidateWorkspaceEntityKindV41([])).toBe('unknown')
  })
})
