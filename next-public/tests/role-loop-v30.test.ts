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

const roleActions = read('components/RoleSearchActions.tsx')
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

describe('V30 PR1 role sourcing loop', () => {
  it('keeps the role route as the single product surface', () => {
    expect(rolePage).toContain('<RoleSearchActions roleId={id} />')
    expect(roleActions).toContain('Search, bring candidates back, review, calibrate')
    expect(roleActions).toContain('Paste candidates back into this role')
    expect(roleActions).toContain('Review role candidates')
  })

  it('keeps guided sources explicitly recruiter-run', () => {
    expect(roleActions).toContain('Guided searches for recruiter-run sources')
    expect(roleActions).toContain('Copy LinkedIn search')
    expect(roleActions).toContain('Copy ClearanceJobs search')
    expect(roleActions).toContain('Copy X-Ray')
    expect(roleActions).toContain('SourcingOS prepared the query; you still run the guided source yourself.')
    expect(roleActions).toContain('SourcingOS did not execute or verify the external source.')
  })

  it('imports recruiter-provided text through the existing Candidate Graph pipeline and links it to the role', () => {
    expect(roleActions).toContain("fetch('/api/candidate-db/import-resume'")
    expect(roleActions).toContain('candidateImportToRoleLinkInput')
    expect(roleActions).toContain('addCanonicalCandidateToRole')
    expect(roleActions).toContain('parseResume(pasteText)')
  })

  it('maps Candidate Graph records into the role without turning search context into evidence', () => {
    const linked = candidateImportToRoleLinkInput({
      candidate: candidate(),
      sourceProfile: sourceProfile(),
      surface: 'clearancejobs',
      laneLabel: 'Balanced / Recruiter Default',
    })

    expect(linked).toMatchObject({
      candidateId: '00000000-0000-4000-8000-000000000001',
      entityKind: 'person',
      displayName: 'Jordan Candidate',
      headline: 'Citrix Infrastructure Engineer',
      organization: 'Example Integrator',
      location: 'Northern Virginia',
      source: 'ClearanceJobs · Balanced / Recruiter Default · recruiter paste-back',
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
