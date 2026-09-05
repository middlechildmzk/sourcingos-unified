// ─────────────────────────────────────────────────────────────────────────────
// V29.2.1 identity trust boundary regression tests.
//
// These tests exist because two P0 trust defects shipped to production:
//   1. buildCandidateGraph appended a source profile into an existing candidate
//      group at heuristic score >= 55, reachable from name + city + employer +
//      one shared skill. That is a common-name collision, not an identity.
//   2. /api/candidates/save accepted z.array(z.any()) and persisted a
//      client-authored candidate graph verbatim.
//
// Each test below pins one of those behaviours shut.
// ─────────────────────────────────────────────────────────────────────────────
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  buildCandidateGraph,
  buildIdentityResolutionDraft,
  compareSourceProfiles,
  confirmCandidateMerge,
  mergeRefreshedProfiles,
} from '../lib/candidate-graph'
import { classifySourceResult } from '../lib/entity-classification'
import { candidateSaveRequestSchema, flattenSaveRequest } from '../lib/source-result-contract'
import type { ContactSignal, SourceName, SourceResult } from '../lib/source-types'

vi.mock('@/lib/auth-gate', () => ({
  requireSession: async () => ({ ok: true, userId: 'user-A', isAdmin: false, preview: false }),
}))
vi.mock('@/lib/rate-limit', () => ({ rateLimit: async () => ({ ok: true }) }))

function result(overrides: Partial<SourceResult> & { source: SourceName; sourceProfileId: string }): SourceResult {
  return {
    id: `${overrides.source}:${overrides.sourceProfileId}`,
    entityKind: 'person',
    displayName: 'Alex Example',
    skills: [],
    evidence: [],
    contactSignals: [],
    identitySignals: [],
    refreshedAt: '2026-07-01T00:00:00.000Z',
    ...overrides,
  }
}

function githubPerson(overrides: Partial<SourceResult> & { sourceProfileId: string }): SourceResult {
  return result({
    source: 'github',
    raw: { type: 'user' },
    ...overrides,
  })
}

function contact(type: ContactSignal['type'], value: string, source: SourceName = 'github'): ContactSignal {
  return { type, value, source, verified: false, note: 'unverified public signal' }
}

async function postSave(body: unknown) {
  const { POST } = await import('../app/api/candidates/save/route')
  const res = await POST(new Request('http://localhost/api/candidates/save', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  }))
  return { status: res.status, json: await res.json() }
}

describe('V29.2.1 - probabilistic matches never link records', () => {
  it('keeps two same-name, same-city, same-employer people with a shared skill separate', () => {
    const a = githubPerson({
      sourceProfileId: 'dchen-infra',
      displayName: 'David Chen',
      location: 'Bethesda, MD',
      organization: 'Lockheed Martin',
      skills: ['python'],
    })
    const b = githubPerson({
      sourceProfileId: 'davidchen91',
      displayName: 'David Chen',
      location: 'Bethesda, MD',
      organization: 'Lockheed Martin',
      skills: ['python'],
    })

    const comparison = compareSourceProfiles(a, b)
    expect(comparison.score).toBeGreaterThanOrEqual(55)
    expect(comparison.deterministicAnchor).toBe(false)

    const draft = buildIdentityResolutionDraft([a, b])
    expect(draft.candidates).toHaveLength(2)
    expect(draft.candidates.every(c => c.sourceProfiles.length === 1)).toBe(true)
    expect(draft.candidates.every(c => c.matchScore === 0)).toBe(true)
  })

  it('emits a pending proposal instead of a linkage', () => {
    const a = githubPerson({ sourceProfileId: 'one', displayName: 'Priya Raman', location: 'Austin, TX' })
    const b = githubPerson({ sourceProfileId: 'two', displayName: 'Priya Raman', location: 'Austin, TX' })

    const draft = buildIdentityResolutionDraft([a, b])
    expect(draft.proposals).toHaveLength(1)

    const proposal = draft.proposals[0]
    expect(proposal.decisionClass).toBe('standard_review')
    expect(proposal.decision).toBe('pending')
    expect(proposal.reviewRequired).toBe(true)
    expect(proposal.linked).toBe(false)
    expect(proposal.reasons.length).toBeGreaterThan(0)
  })

  it('never links on name-only, employer-only or skill-only evidence', () => {
    const nameOnly = buildIdentityResolutionDraft([
      githubPerson({ sourceProfileId: 'a', displayName: 'Sam Okafor' }),
      githubPerson({ sourceProfileId: 'b', displayName: 'Sam Okafor' }),
    ])
    const employerOnly = buildIdentityResolutionDraft([
      githubPerson({ sourceProfileId: 'c', displayName: 'Lin Wei', organization: 'Leidos' }),
      githubPerson({ sourceProfileId: 'd', displayName: 'Wei Lin', organization: 'Leidos' }),
    ])
    const skillOnly = buildIdentityResolutionDraft([
      githubPerson({ sourceProfileId: 'e', displayName: 'Ana Gomez', skills: ['rust', 'wasm'] }),
      githubPerson({ sourceProfileId: 'f', displayName: 'Beatriz Silva', skills: ['rust', 'wasm'] }),
    ])

    for (const draft of [nameOnly, employerOnly, skillOnly]) {
      expect(draft.candidates).toHaveLength(2)
      expect(draft.proposals.every(p => p.linked === false)).toBe(true)
      expect(draft.proposals.every(p => p.decisionClass !== 'exact_source_reuse')).toBe(true)
    }
  })

  it('treats differing public emails as material negative evidence without suppressing recruiter review', () => {
    const a = githubPerson({
      sourceProfileId: 'a',
      displayName: 'Jordan Reed',
      contactSignals: [contact('public_email', 'jordan@alpha.dev')],
    })
    const b = githubPerson({
      sourceProfileId: 'b',
      displayName: 'Jordan Reed',
      contactSignals: [contact('public_email', 'jordan@beta.dev')],
    })

    const draft = buildIdentityResolutionDraft([a, b])
    expect(draft.candidates).toHaveLength(2)

    const proposal = draft.proposals[0]
    expect(proposal.decisionClass).toBe('standard_review')
    expect(proposal.reviewRequired).toBe(true)
    expect(proposal.linked).toBe(false)
    expect(proposal.conflicts.some(c => c.type === 'different_public_email' && c.severity === 'material')).toBe(true)
  })

  it('does not treat an email as a domain when normalizing', () => {
    const a = githubPerson({
      sourceProfileId: 'a',
      displayName: 'Alex Example',
      contactSignals: [contact('public_email', 'alex@example.com')],
    })
    const b = githubPerson({
      sourceProfileId: 'b',
      displayName: 'Alex Example',
      contactSignals: [contact('website', 'https://alexexample.com')],
    })

    const comparison = compareSourceProfiles(a, b)
    expect(comparison.reasons).not.toContain('Same observed public email')
    expect(comparison.deterministicAnchor).toBe(false)
  })

  it('ranks an explicit cross-profile link as high priority review, still unlinked', () => {
    const site = result({
      source: 'stackoverflow',
      sourceProfileId: 'so-42',
      displayName: 'Dana Whitfield',
      profileUrl: 'https://stackoverflow.com/users/42',
    })
    const gh = githubPerson({
      sourceProfileId: 'danaw',
      displayName: 'Dana Whitfield',
      identitySignals: [
        { type: 'source_url', value: 'https://stackoverflow.com/users/42', weight: 40, source: 'github' },
      ],
    })

    const draft = buildIdentityResolutionDraft([site, gh])
    expect(draft.candidates).toHaveLength(2)

    const proposal = draft.proposals[0]
    expect(proposal.decisionClass).toBe('high_priority_review')
    expect(proposal.reviewRequired).toBe(true)
    expect(proposal.linked).toBe(false)
  })
})

describe('V29.2.1 - exact source identity stays idempotent', () => {
  it('collapses a repeated same-source record without creating a merge decision', () => {
    const first = githubPerson({ sourceProfileId: 'octo', displayName: 'Octo Dev' })
    const repeat = githubPerson({ sourceProfileId: 'octo', displayName: 'Octo Dev' })

    const draft = buildIdentityResolutionDraft([first, repeat])
    expect(draft.candidates).toHaveLength(1)
    expect(draft.duplicatesCollapsed).toBe(1)

    const proposal = draft.proposals[0]
    expect(proposal.decisionClass).toBe('exact_source_reuse')
    expect(proposal.reviewRequired).toBe(false)
    expect(proposal.conflicts).toHaveLength(0)
  })

  it('uses a stable candidate id regardless of result ordering', () => {
    const first = githubPerson({ sourceProfileId: 'octo', displayName: 'Octo Dev' })
    const other = githubPerson({ sourceProfileId: 'other', displayName: 'Other Dev' })

    const firstOrder = buildIdentityResolutionDraft([first, other])
    const secondOrder = buildIdentityResolutionDraft([other, first])
    const firstId = firstOrder.candidates.find(candidate => candidate.sourceProfiles[0]?.sourceProfileId === 'octo')?.id
    const secondId = secondOrder.candidates.find(candidate => candidate.sourceProfiles[0]?.sourceProfileId === 'octo')?.id

    expect(firstId).toBe('candidate-github-octo')
    expect(secondId).toBe(firstId)
  })
})

describe('V29.2.1 - name-based refresh cannot attach a stranger', () => {
  it('only replaces source profiles the candidate already owns', () => {
    const owned = githubPerson({ sourceProfileId: 'octo', displayName: 'Chris Park' })
    const [candidate] = buildIdentityResolutionDraft([owned]).candidates

    const refreshedOwned = githubPerson({
      sourceProfileId: 'octo',
      displayName: 'Chris Park',
      headline: 'Updated headline',
    })
    const stranger = githubPerson({ sourceProfileId: 'other-chris', displayName: 'Chris Park' })

    const updated = mergeRefreshedProfiles(candidate, [refreshedOwned, stranger])
    expect(updated.sourceProfiles).toHaveLength(1)
    expect(updated.sourceProfiles[0].sourceProfileId).toBe('octo')
    expect(updated.sourceProfiles[0].headline).toBe('Updated headline')
  })
})

describe('V29.2.1 - merge decisions require a real multi-profile review', () => {
  it('does not mark a one-source candidate as linked', () => {
    const [candidate] = buildIdentityResolutionDraft([
      githubPerson({ sourceProfileId: 'solo', displayName: 'Solo Person' }),
    ]).candidates

    const updated = confirmCandidateMerge(candidate, [candidate.sourceProfiles[0].id], 'confirmed')
    expect(updated).toBe(candidate)
    expect(updated.status).toBe('needs_review')
  })

  it('does not act on arbitrary source profile ids without a matching pending review', () => {
    const [candidate] = buildIdentityResolutionDraft([
      githubPerson({ sourceProfileId: 'solo', displayName: 'Solo Person' }),
    ]).candidates

    const updated = confirmCandidateMerge(candidate, ['one', 'two'], 'confirmed')
    expect(updated).toBe(candidate)
    expect(updated.status).toBe('needs_review')
  })
})

describe('V29.2.1 - only person anchors become candidates', () => {
  it('refuses a publication that claims to be a person', () => {
    const draft = buildIdentityResolutionDraft([
      result({ source: 'arxiv', sourceProfileId: '2401.00001', entityKind: 'person', displayName: 'Attention Is All You Need' }),
    ])
    expect(draft.candidates).toHaveLength(0)
    expect(draft.excluded[0].entityKind).toBe('publication')
  })

  it('refuses a package', () => {
    const draft = buildIdentityResolutionDraft([
      result({ source: 'npm', sourceProfileId: 'left-pad', entityKind: 'person', displayName: 'left-pad' }),
    ])
    expect(draft.candidates).toHaveLength(0)
    expect(draft.excluded[0].entityKind).toBe('artifact')
  })

  it('refuses an identifier-only ORCID record', () => {
    const draft = buildIdentityResolutionDraft([
      result({ source: 'orcid', sourceProfileId: '0000-0002-1825-0097', entityKind: 'person', displayName: '0000-0002-1825-0097', raw: {} }),
    ])
    expect(draft.candidates).toHaveLength(0)
    expect(draft.excluded[0].entityKind).toBe('unknown')
  })

  it('refuses a GitHub organization and a GitHub bot', () => {
    const org = buildIdentityResolutionDraft([
      result({ source: 'github', sourceProfileId: 'vercel', entityKind: 'person', displayName: 'Vercel', raw: { type: 'Organization' } }),
    ])
    const bot = buildIdentityResolutionDraft([
      result({ source: 'github', sourceProfileId: 'dependabot', entityKind: 'person', displayName: 'dependabot', raw: { type: 'Bot' } }),
    ])
    expect(org.candidates).toHaveLength(0)
    expect(org.excluded[0].entityKind).toBe('organization')
    expect(bot.candidates).toHaveLength(0)
    expect(bot.excluded[0].entityKind).toBe('unknown')
  })

  it('refuses a discovery lane result', () => {
    const draft = buildIdentityResolutionDraft([
      result({ source: 'resume_xray', sourceProfileId: 'lane-1', entityKind: 'person', displayName: 'Resume X-ray lane' }),
    ])
    expect(draft.candidates).toHaveLength(0)
    expect(draft.excluded[0].entityKind).toBe('search_lane')
  })
})

describe('V29.2.1 - field hygiene is re-derived server-side', () => {
  it('strips a profile URL from contact signals', () => {
    const classified = classifySourceResult(githubPerson({
      sourceProfileId: 'a',
      contactSignals: [
        contact('profile_url', 'https://github.com/a'),
        contact('public_email', 'a@example.com'),
      ],
    }))
    expect(classified.contactSignals.map(c => c.type)).toEqual(['public_email'])
  })

  it('does not let recruiter query terms become skills on sources that report none', () => {
    const classified = classifySourceResult(result({
      source: 'stackoverflow',
      sourceProfileId: 'so-1',
      displayName: 'Ravi Menon',
      skills: ['ts/sci', 'kubernetes', 'terraform'],
    }))
    expect(classified.skills).toEqual([])
    expect(classified.identitySignals.filter(s => s.type === 'skill')).toHaveLength(0)
  })
})

describe('V29.2.1 - the save route does not trust the client', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('rejects a body with no source results', () => {
    expect(candidateSaveRequestSchema.safeParse({}).success).toBe(false)
  })

  it('rejects a contact signal that claims to be verified', () => {
    const parsed = candidateSaveRequestSchema.safeParse({
      sourceResults: [{
        ...githubPerson({ sourceProfileId: 'a' }),
        contactSignals: [{ type: 'public_email', value: 'a@b.com', source: 'github', verified: true, note: '' }],
      }],
    })
    expect(parsed.success).toBe(false)
  })

  it('discards a client-submitted grouping and keeps the profiles separate', () => {
    const body = candidateSaveRequestSchema.parse({
      candidateGraph: [{
        sourceProfiles: [
          githubPerson({ sourceProfileId: 'a', displayName: 'Same Name' }),
          githubPerson({ sourceProfileId: 'b', displayName: 'Same Name' }),
        ],
      }],
    })
    const { results, discardedClientGroupings } = flattenSaveRequest(body)
    expect(discardedClientGroupings).toBe(1)
    expect(results).toHaveLength(2)

    const draft = buildIdentityResolutionDraft(results as SourceResult[])
    expect(draft.candidates).toHaveLength(2)
  })

  it('saves person anchors as separate records and reports proposals', async () => {
    const { status, json } = await postSave({
      sourceResults: [
        githubPerson({ sourceProfileId: 'p1', displayName: 'Same Name', location: 'Reston, VA' }),
        githubPerson({ sourceProfileId: 'p2', displayName: 'Same Name', location: 'Reston, VA' }),
      ],
    })
    expect(status).toBe(200)
    expect(json.ok).toBe(true)
    expect(json.savedCount).toBe(2)
    expect(json.identityProposals).toHaveLength(1)
    expect(json.identityProposals[0].linked).toBe(false)
    expect(json.candidates.every((c: { sourceProfiles: unknown[] }) => c.sourceProfiles.length === 1)).toBe(true)
  })

  it('refuses a submission that contains only non-person subjects', async () => {
    const { status, json } = await postSave({
      sourceResults: [
        result({ source: 'arxiv', sourceProfileId: 'pub-1', entityKind: 'person', displayName: 'Some Paper' }),
        result({ source: 'npm', sourceProfileId: 'pkg-1', entityKind: 'person', displayName: 'some-package' }),
      ],
    })
    expect(status).toBe(422)
    expect(json.ok).toBe(false)
    expect(json.savedCount).toBe(0)
    expect(json.rejected).toHaveLength(2)
  })

  it('no longer accepts an arbitrary client-authored candidate graph', async () => {
    const { status, json } = await postSave({
      candidateGraph: [{ id: 'anything', canonicalName: 'Injected', sourceProfiles: [{ nonsense: true }] }],
    })
    expect(status).toBe(400)
    expect(json.ok).toBe(false)
  })
})

describe('V29.2.1 - published guardrails match actual behaviour', () => {
  it('does not advertise grouping that the resolver does not perform', () => {
    const draft = buildIdentityResolutionDraft([
      githubPerson({ sourceProfileId: 'x', displayName: 'Same Name', location: 'Denver, CO', organization: 'Raytheon', skills: ['go'] }),
      githubPerson({ sourceProfileId: 'y', displayName: 'Same Name', location: 'Denver, CO', organization: 'Raytheon', skills: ['go'] }),
    ])
    expect(draft.candidates).toHaveLength(2)
    expect(draft.resolverVersion).toBe('v29.2.1-proposal-only')
  })

  it('keeps buildCandidateGraph callers on unmerged records', () => {
    const graph = buildCandidateGraph([
      githubPerson({ sourceProfileId: 'x', displayName: 'Same Name', location: 'Denver, CO', organization: 'Raytheon', skills: ['go'] }),
      githubPerson({ sourceProfileId: 'y', displayName: 'Same Name', location: 'Denver, CO', organization: 'Raytheon', skills: ['go'] }),
    ])
    expect(graph).toHaveLength(2)
    expect(graph.every(c => c.sourceProfiles.length === 1)).toBe(true)
    expect(graph.flatMap(c => c.matchReviews)).toHaveLength(0)
  })
})
