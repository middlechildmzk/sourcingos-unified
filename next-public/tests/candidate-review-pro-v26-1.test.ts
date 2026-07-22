import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import {
  candidateEvidenceDimensions,
  candidateReviewScore,
  matchedRoleSignals,
} from '@/lib/candidate-review-pro'
import type { RoleCandidate, RoleIntake } from '@/lib/role-workspace'

const root = path.resolve(__dirname, '..')
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8')

const roleDetail = read('components/RoleDetailClient.tsx')
const review = read('components/CandidateReviewPro.tsx')
const styles = read('app/app/v26-candidate-review.css')
const layout = read('app/app/layout.tsx')

const intake: RoleIntake = {
  title: 'Senior DevSecOps Engineer',
  location: 'United States',
  workMode: 'remote',
  compensation: 'Not specified',
  clearance: 'Secret',
  mustHaves: ['AWS', 'Kubernetes', 'Terraform'],
  niceToHaves: ['Python'],
  disqualifiers: [],
  targetCompanies: [],
  adjacentBackgrounds: ['Cloud Security'],
  hiringManagerNotes: '',
  rawDescription: '',
}

function candidate(overrides: Partial<RoleCandidate> = {}): RoleCandidate {
  return {
    id: 'candidate-1',
    candidateId: 'graph-1',
    name: 'Jordan Candidate',
    headline: 'Senior Cloud Security Engineer',
    company: 'Example',
    location: 'Minnesota',
    source: 'Candidate Graph',
    sourceUrl: 'https://example.com/profile',
    stage: 'shortlisted',
    fitDecision: 'strong_fit',
    fitReasons: ['AWS, Kubernetes, and Terraform production ownership'],
    concerns: [],
    tags: ['AWS', 'Kubernetes', 'Terraform', 'Cloud Security'],
    contactStatus: 'verified',
    evidenceStatus: 'reviewed',
    addedAt: '2026-07-21T00:00:00.000Z',
    updatedAt: '2026-07-21T00:00:00.000Z',
    ...overrides,
  }
}

describe('V26.1 Candidate Review Pro', () => {
  it('scores only recorded role signals and review state', () => {
    const strong = candidate()
    expect(matchedRoleSignals(strong, intake.mustHaves)).toEqual(['AWS', 'Kubernetes', 'Terraform'])
    expect(candidateReviewScore(strong, intake)).toBe(100)

    const incomplete = candidate({
      candidateId: undefined,
      sourceUrl: undefined,
      tags: ['AWS'],
      fitReasons: [],
      headline: 'Engineer',
      fitDecision: 'unreviewed',
      evidenceStatus: 'unreviewed',
      contactStatus: 'unknown',
    })
    expect(candidateReviewScore(incomplete, intake)).toBeLessThan(45)
  })

  it('keeps missing and conflicting evidence visible', () => {
    const dimensions = candidateEvidenceDimensions(candidate({ evidenceStatus: 'conflicting', location: '' }), intake)
    expect(dimensions.find(item => item.label === 'Evidence state')).toMatchObject({ tone: 'risk', value: 'conflicting' })
    expect(dimensions.find(item => item.label === 'Location and work mode')).toMatchObject({ tone: 'unknown', value: 'Unknown' })
    expect(dimensions.some(item => item.detail.includes('before presentation or outreach'))).toBe(true)
  })

  it('supports keyboard review and save-next flow', () => {
    expect(review).toContain("if (key === '1')")
    expect(review).toContain("if (key === '2')")
    expect(review).toContain("if (key === '3')")
    expect(review).toContain("if (key === 's')")
    expect(review).toContain("if (key === 'e')")
    expect(review).toContain("if (key === 'n' && hasNext)")
    expect(review).toContain("event.metaKey || event.ctrlKey")
    expect(review).toContain('Save & next')
  })

  it('adds bulk actions, undo, prioritization, and finalist comparison', () => {
    expect(roleDetail).toContain('candidatePriority')
    expect(roleDetail).toContain('updateCandidates')
    expect(roleDetail).toContain('undoLastCandidateChange')
    expect(roleDetail).toContain('Select all')
    expect(roleDetail).toContain('Apply stage')
    expect(roleDetail).toContain('Compare')
    expect(roleDetail).toContain('CandidateComparisonDialog')
    expect(review).toContain('Compare role evidence side by side')
    expect(review).toContain('Unknown stays unknown until a recruiter verifies it.')
  })

  it('loads the responsive Candidate Review Pro design layer', () => {
    expect(layout).toContain("import './v26-candidate-review.css'")
    expect(styles).toContain('.candidate-review-command')
    expect(styles).toContain('.candidate-bulk-bar')
    expect(styles).toContain('.candidate-evidence-grid')
    expect(styles).toContain('.candidate-compare-table')
    expect(styles).toContain('@media(max-width:520px)')
  })
})
