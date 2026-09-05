import { describe, expect, it } from 'vitest'
import { buildSlateCopilotAnswerV38_1, classifySlateCopilotIntentV38_1 } from '@/lib/slate-copilot-v38-1'

const candidates = [
  {
    displayName: 'Candidate One',
    currentTitle: 'RHEL Administrator',
    currentEmployer: 'Example Co',
    location: 'Fort Meade, MD',
    skills: ['RHEL', 'Ansible'],
    provider: 'exa',
    profileUrls: [{ kind: 'linkedin', url: 'https://www.linkedin.com/in/example-one' }],
    why: 'Observed RHEL in Exa evidence.',
    supportedEvidence: 2,
  },
  {
    displayName: 'Candidate Two',
    currentTitle: 'Linux Systems Administrator',
    currentEmployer: 'Second Co',
    location: 'Columbia, MD',
    skills: ['Linux'],
    provider: 'pearch',
    profileUrls: [],
    why: 'Retrieved by Pearch for this search; review evidence before judging fit.',
    supportedEvidence: 0,
  },
]

describe('V38.1 slate copilot', () => {
  it('routes why-selected language to slate QA rather than search intent', () => {
    expect(classifySlateCopilotIntentV38_1('why did you select the top 3?')).toBe('why_candidates')
  })

  it('answers why-selected questions from the current slate', () => {
    const answer = buildSlateCopilotAnswerV38_1({ input: 'why did you select the top 2?', candidates, selectedIndex: 0 })
    expect(answer).toContain('retrieval/review reasons')
    expect(answer).toContain('Candidate One')
    expect(answer).toContain('Candidate Two')
    expect(answer).toContain('not hiring recommendations')
  })

  it('keeps missing evidence unknown instead of converting it to a negative', () => {
    const answer = buildSlateCopilotAnswerV38_1({ input: 'which candidates have Kubernetes evidence?', candidates })
    expect(answer).toContain('not evidenced')
    expect(answer).toContain('not “does not have it.”')
  })

  it('never invents an external profile URL', () => {
    const answer = buildSlateCopilotAnswerV38_1({ input: 'show me linkedin and github', candidates, selectedIndex: 1 })
    expect(answer).toContain('No external profile URL was observed')
    expect(answer).not.toContain('linkedin.com/in/candidate-two')
  })

  it('explains explicit approval for contact enrichment', () => {
    const answer = buildSlateCopilotAnswerV38_1({ input: 'find contact info', candidates, selectedIndex: 0 })
    expect(answer).toContain('Find contact')
    expect(answer).toContain('explicit approval')
    expect(answer).toContain('permission to contact')
  })
})
