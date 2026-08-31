import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import type { CandidateRecord, SourceProfileRecord } from '@/lib/candidate-db-v18'
import {
  candidateImportToRoleLinkInput,
  recruiterPasteBackSourceLabel,
} from '@/lib/role-paste-back'

const root = path.resolve(__dirname, '..')
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8')

const canonicalSearch = read('components/RoleCanonicalSearchActions.tsx')
const pasteBack = read('components/RolePasteBackV33.tsx')
const rolePage = read('app/app/roles/[id]/page.tsx')
const importRoute = read('app/api/candidate-db/import-resume/route.ts')

function candidate(): CandidateRecord {
  return {
    id: '00000000-0000-4000-8000-000000000001',
    canonicalName: 'Jordan Candidate',
    headline: 'Citrix Infrastructure Engineer',
    location: 'Northern Virginia',
    currentCompany: 'Example Integrator',
    currentTitle: 'Citrix Infrastructure Engineer',
    summary: 'Recruiter-provided candidate import.',
    skills: ['Citrix', 'VMware'],
    createdAt: '2026-08-28T00:00:00.000Z',
    updatedAt: '2026-08-28T00:00:00.000Z',
    sourceProfileIds: ['00000000-0000-4000-8000-000000000002'],
    evidenceItemIds: ['00000000-0000-4000-8000-000000000003'],
    contactSignalIds: [],
    openToWorkSignalIds: [],
    mergeStatus: 'pending',
  }
}

function sourceProfile(): SourceProfileRecord {
  return {
    id: '00000000-0000-4000-8000-000000000002',
    candidateId: '00000000-0000-4000-8000-000000000001',
    source: 'uploaded_resume',
    sourceProfileId: 'role-import',
    profileUrl: 'https://example.com/candidate',
    displayName: 'Jordan Candidate',
    headline: 'Citrix Infrastructure Engineer',
    location: 'Northern Virginia',
    organization: 'Example Integrator',
    rawText: 'Jordan Candidate\nCitrix Infrastructure Engineer\nVMware',
    status: 'pending',
    matchScore: 0,
    matchReasons: ['Created from recruiter-provided resume text'],
    lastSeenAt: '2026-08-28T00:00:00.000Z',
    createdAt: '2026-08-28T00:00:00.000Z',
  }
}

describe('role sourcing loop on canonical V33 Search Brain', () => {
  it('keeps search and guided paste-back on the role route without the legacy second planner', () => {
    expect(rolePage).toContain('<RoleCanonicalSearchActions roleId={id} />')
    expect(rolePage).toContain('<RolePasteBackV33 roleId={id} />')
    expect(rolePage).not.toContain('<RoleSearchActions roleId={id} />')
    expect(canonicalSearch).toContain('One Search Brain')
    expect(canonicalSearch).toContain('Search Plan v')
    expect(pasteBack).toContain('Bring candidates back to this role')
    expect(pasteBack).toContain('Review role candidates')
  })

  it('derives guided source queries from the canonical role plan', () => {
    expect(canonicalSearch).toContain('buildCanonicalAgenticSearchPlan')
    expect(canonicalSearch).toContain("surface: 'linkedin_recruiter'")
    expect(canonicalSearch).toContain("surface: 'clearancejobs'")
    expect(canonicalSearch).toContain("surface: 'google_xray'")
    expect(canonicalSearch).not.toContain('calibrated-guided-search')
    expect(canonicalSearch).not.toContain('jd-boolean-lanes')
  })

  it('keeps guided sources explicitly recruiter-run', () => {
    expect(canonicalSearch).toContain('Guided · recruiter-run')
    expect(canonicalSearch).toContain('you still run the guided source in your authorized account')
    expect(canonicalSearch).toContain('Approve hypothesis')
    expect(canonicalSearch).toContain('Copy query')
  })

  it('imports recruiter-provided text through Candidate Graph and links it back to the canonical role', () => {
    expect(pasteBack).toContain("fetch('/api/candidate-db/import-resume'")
    expect(pasteBack).toContain('candidateImportToRoleLinkInput')
    expect(pasteBack).toContain('addCanonicalCandidateToRole')
    expect(pasteBack).toContain('parseResume(text)')
    expect(pasteBack).toContain('planRevision: activePlan.revision')
    expect(pasteBack).toContain('laneLabel: lane.label')
  })

  it('maps Candidate Graph records into the role without turning search context into evidence', () => {
    const linked = candidateImportToRoleLinkInput({
      candidate: candidate(),
      sourceProfile: sourceProfile(),
      surface: 'clearancejobs',
      laneLabel: 'Exact-title hypothesis',
      planRevision: 2,
    })

    expect(linked).toMatchObject({
      candidateId: '00000000-0000-4000-8000-000000000001',
      entityKind: 'person',
      displayName: 'Jordan Candidate',
      headline: 'Citrix Infrastructure Engineer',
      organization: 'Example Integrator',
      location: 'Northern Virginia',
      source: 'ClearanceJobs · Exact-title hypothesis · Search Plan v2 · recruiter paste-back',
      profileUrl: 'https://example.com/candidate',
      skills: ['Citrix', 'VMware'],
      contactSignalCount: 0,
    })
  })

  it('does not preserve unsafe source URLs', () => {
    const linked = candidateImportToRoleLinkInput({
      candidate: candidate(),
      sourceProfile: { ...sourceProfile(), profileUrl: undefined },
      surface: 'linkedin_recruiter',
      sourceUrl: 'javascript:alert(1)',
    })
    expect(linked.profileUrl).toBeUndefined()
    expect(recruiterPasteBackSourceLabel('linkedin_recruiter')).toBe('LinkedIn Recruiter · recruiter paste-back')
  })

  it('persists an optional safe source URL on the existing recruiter-provided import record', () => {
    expect(importRoute).toContain('function safeProfileUrl')
    expect(importRoute).toContain("parsed.protocol !== 'http:' && parsed.protocol !== 'https:'")
    expect(importRoute).toContain('profileUrl,')
    expect(importRoute).toContain("source: 'uploaded_resume'")
    expect(importRoute).toContain("matchReasons: ['Created from recruiter-provided resume text']")
  })
})
