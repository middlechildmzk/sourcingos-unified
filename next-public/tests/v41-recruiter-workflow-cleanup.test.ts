import { describe, expect, it } from 'vitest'
import { reviewShortcutBlockedByModifierV41 } from '@/lib/review/session-v41'
import { talentListVisibilityV41 } from '@/lib/talent-list-visibility-v41'

type ModifierState = Pick<KeyboardEvent, 'metaKey' | 'ctrlKey' | 'altKey'>

function modifiers(overrides: Partial<ModifierState> = {}): ModifierState {
  return { metaKey: false, ctrlKey: false, altKey: false, ...overrides }
}

describe('V41 review-session shortcut modifier guard', () => {
  it('allows an unmodified decision key', () => {
    expect(reviewShortcutBlockedByModifierV41(modifiers())).toBe(false)
  })

  // The defect this proves: with no guard, Cmd+F was intercepted by the review
  // handler, which called preventDefault, recorded an evidence-fit decision and
  // advanced the session. A browser find must never mutate a recruiter decision.
  it('blocks Meta chords so Cmd+F cannot record a decision', () => {
    expect(reviewShortcutBlockedByModifierV41(modifiers({ metaKey: true }))).toBe(true)
  })

  it('blocks Ctrl chords so Ctrl+X cannot record not-a-fit', () => {
    expect(reviewShortcutBlockedByModifierV41(modifiers({ ctrlKey: true }))).toBe(true)
  })

  it('blocks Alt chords used by screen readers', () => {
    expect(reviewShortcutBlockedByModifierV41(modifiers({ altKey: true }))).toBe(true)
  })

  it('does not block Shift, which opens the note field before committing', () => {
    // Shift is absent from the guard's input by design; a Shift-only keystroke
    // reaches the handler with every blocking modifier false.
    expect(reviewShortcutBlockedByModifierV41(modifiers())).toBe(false)
  })
})

describe('V41 Talent list withheld-row disclosure', () => {
  const person = { entityKind: 'person' as const }
  const org = { entityKind: 'organization' as const }
  const unknown = { entityKind: 'unknown' as const }

  it('reports a clean page of people with nothing withheld', () => {
    const result = talentListVisibilityV41([person, person, person])
    expect(result).toMatchObject({ personCount: 3, withheldCount: 0, hasWithheldOnly: false, emptyReason: null })
  })

  it('counts non-person rows as withheld rather than dropping them silently', () => {
    const result = talentListVisibilityV41([person, org, unknown])
    expect(result.personCount).toBe(1)
    expect(result.withheldCount).toBe(2)
    expect(result.emptyReason).toBeNull()
  })

  // The 160-rows regression: the graph returned rows, the header metric counted
  // them, and the list said "No people yet." That empty state was wrong — the
  // records exist, they just did not classify as people.
  it('distinguishes an all-withheld page from an empty library', () => {
    const result = talentListVisibilityV41([org, unknown, unknown])
    expect(result.hasWithheldOnly).toBe(true)
    expect(result.emptyReason).toBe('all_withheld')
  })

  it('still reports a genuinely empty library as no records', () => {
    expect(talentListVisibilityV41([]).emptyReason).toBe('no_records')
  })

  it('reports an unmatched search distinctly from an empty library', () => {
    expect(talentListVisibilityV41([], { searchApplied: true }).emptyReason).toBe('no_search_match')
  })

  it('prefers the withheld explanation over the search-miss explanation', () => {
    // A search that returned only non-person rows is not "no match found".
    expect(talentListVisibilityV41([org], { searchApplied: true }).emptyReason).toBe('all_withheld')
  })

  it('never reclassifies a withheld row as a person', () => {
    const result = talentListVisibilityV41([unknown, unknown])
    expect(result.personCount).toBe(0)
  })
})
