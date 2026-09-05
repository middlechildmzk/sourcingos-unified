import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  NEGATIVE_REVIEW_REASONS,
  concernsAfterReviewDecision,
  reviewReasonLabel,
} from '@/lib/recruiter-review-reasons-v33-4'
import { pickSlateEvidenceSnippet } from '@/lib/slate-evidence-v33-4'

describe('V33.4 fast recruiter review', () => {
  it('stores one standardized negative reason plus optional recruiter detail', () => {
    const concerns = concernsAfterReviewDecision(
      ['Existing evidence concern'],
      'not_fit',
      'too_hands_on',
      'Strong implementation history, but no architecture ownership signal.'
    )
    expect(reviewReasonLabel('too_hands_on')).toBe('Too hands-on')
    expect(concerns).toEqual([
      'Too hands-on',
      'Recruiter note: Strong implementation history, but no architecture ownership signal.',
      'Existing evidence concern',
    ])
  })

  it('clears stale structured rejection feedback when the recruiter changes the decision', () => {
    const next = concernsAfterReviewDecision([
      'Too junior',
      'Recruiter note: Scope was below the role.',
      'Independent evidence concern',
    ], 'strong_fit')
    expect(next).toEqual(['Independent evidence concern'])
  })

  it('keeps the review vocabulary small and recruiting-specific', () => {
    expect(NEGATIVE_REVIEW_REASONS.map(reason => reason.label)).toEqual([
      'Too hands-on',
      'Too junior',
      'Too senior',
      'Wrong domain',
      'Location / work mode',
      'Requirement conflict',
      'Other',
    ])
  })

  it('prefers source-linked supported must-have evidence for the slate snippet', () => {
    const snippet = pickSlateEvidenceSnippet([
      {
        requirementText: 'Federal environment',
        tier: 'preferred',
        state: 'supported',
        evidence: [{ source: 'Profile', detail: 'Worked in a regulated program.' }],
        contradictions: [],
      },
      {
        requirementText: 'Kubernetes architecture',
        tier: 'must_have',
        state: 'supported',
        evidence: [{ source: 'GitHub', sourceUrl: 'https://example.com/repo', detail: 'Maintains platform architecture repository.' }],
        contradictions: [],
      },
    ])
    expect(snippet).toMatchObject({
      requirementText: 'Kubernetes architecture',
      state: 'supported',
      source: 'GitHub',
      sourceUrl: 'https://example.com/repo',
    })
  })

  it('shows a contradiction only when no positive/verification evidence snippet exists', () => {
    const snippet = pickSlateEvidenceSnippet([
      {
        requirementText: 'Onsite in Northern Virginia',
        tier: 'must_have',
        state: 'contradicted',
        evidence: [],
        contradictions: [{ source: 'Resume', sourceUrl: 'https://example.com/resume', detail: 'Candidate states relocation is not available.' }],
      },
    ])
    expect(snippet).toMatchObject({ state: 'contradicted', contradiction: true, source: 'Resume' })
  })

  it('renders chips and direct evidence links without reintroducing a fit score', () => {
    const source = readFileSync(new URL('../components/RoleUnifiedWorkbenchV33_4.tsx', import.meta.url), 'utf8')
    expect(source).toContain('NEGATIVE_REVIEW_REASONS.map')
    expect(source).toContain('aria-pressed')
    expect(source).toContain('Open {snippet.source} evidence')
    expect(source).toContain('No source-linked evidence snippet yet.')
    expect(source).toContain('Unknown evidence is not a rejection reason')
    expect(source).not.toContain('matchPercent')
    expect(source).not.toContain('fitScore')
  })
})
