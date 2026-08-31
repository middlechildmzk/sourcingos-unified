import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

import { compareSourceProfiles } from '../lib/candidate-graph'
import { buildGitHubDossier } from '../lib/connectors/github-v2'
import { buildStackOverflowDossier } from '../lib/connectors/stackoverflow-v2'
import { assessCrossSourceIdentity, assessDossierBatch } from '../lib/connectors/identity-anchors-v33-3'
import { dossierToSourceResult } from '../lib/connectors/source-truth-v33-3'
import {
  caseAGitHub,
  caseAStackOverflow,
  caseBGitHub,
  caseBStackOverflow,
  caseDStackOverflow,
} from './fixtures/v33-3a-technical-talent-graph'

const janeGitHub = buildGitHubDossier(caseAGitHub)!
const janeStack = buildStackOverflowDossier(caseAStackOverflow)!
const alexGitHub = buildGitHubDossier(caseBGitHub)!
const alexStack = buildStackOverflowDossier(caseBStackOverflow)!

describe('V33.3A identity gate: Case A — shared personal domain', () => {
  it('produces a recruiter proposal, never a merge', () => {
    const assessment = assessCrossSourceIdentity(janeGitHub, janeStack)

    expect(assessment.outcome).toBe('proposal')
    expect(assessment.deterministicMatches.map(match => match.kind)).toContain('personal_domain')
    expect(assessment.deterministicMatches[0].normalized).toBe('jane.dev')
    expect(assessment.summary).toContain('Recruiter review required')
    expect(assessment).not.toHaveProperty('merged')
    expect(assessment.outcome).not.toBe('merge')
  })

  it('normalizes a deep path on one side to the same domain anchor', () => {
    const stackDomain = janeStack.anchors.find(anchor => anchor.kind === 'personal_domain')
    const githubDomain = janeGitHub.anchors.find(anchor => anchor.kind === 'personal_domain')
    expect(stackDomain?.normalized).toBe('jane.dev')
    expect(githubDomain?.normalized).toBe('jane.dev')
  })

  it('reaches the canonical Identity Brain through the SourceResult bridge', () => {
    const comparison = compareSourceProfiles(
      dossierToSourceResult(janeGitHub),
      dossierToSourceResult(janeStack),
    )
    expect(comparison.deterministicAnchor).toBe(true)
    expect(comparison.blocked).toBe(false)
    expect(comparison.reasons.join(' ')).toContain('jane.dev')
  })
})

describe('V33.3A identity gate: Case B — common-name collision', () => {
  it('keeps two different people separate', () => {
    const assessment = assessCrossSourceIdentity(alexGitHub, alexStack)

    expect(assessment.outcome).toBe('no_link')
    expect(assessment.deterministicMatches).toEqual([])
  })

  it('records the name match as supporting only, never as an anchor', () => {
    const assessment = assessCrossSourceIdentity(alexGitHub, alexStack)
    const nameSimilarity = assessment.supporting.find(item => item.kind === 'display_name')
    expect(nameSimilarity).toBeDefined()
    expect(nameSimilarity!.detail).toContain('cannot create a proposal on its own')
  })

  it('surfaces the conflicting domains and locations for the recruiter', () => {
    const assessment = assessCrossSourceIdentity(alexGitHub, alexStack)
    const kinds = assessment.conflicts.map(conflict => conflict.kind)
    expect(kinds).toContain('different_personal_domain')
    expect(kinds).toContain('different_stated_location')
  })

  it('the canonical Identity Brain also declines to anchor them', () => {
    const comparison = compareSourceProfiles(
      dossierToSourceResult(alexGitHub),
      dossierToSourceResult(alexStack),
    )
    expect(comparison.deterministicAnchor).toBe(false)
  })

  it('shared technology overlap does not upgrade the outcome', () => {
    // Both Alex records observe kubernetes. Overlap must stay supporting.
    const assessment = assessCrossSourceIdentity(alexGitHub, alexStack)
    expect(assessment.outcome).toBe('no_link')
  })
})

describe('V33.3A identity gate: batch behaviour', () => {
  it('returns only pairs worth a recruiter decision, ranked', () => {
    const rinStack = buildStackOverflowDossier(caseDStackOverflow)!
    const pairs = assessDossierBatch([janeGitHub, janeStack, alexGitHub, alexStack, rinStack])

    expect(pairs.length).toBeGreaterThanOrEqual(1)
    expect(pairs[0].assessment.outcome).toBe('proposal')
    for (const pair of pairs) {
      expect(pair.left.source).not.toBe(pair.right.source)
      expect(pair.assessment.outcome).not.toBe('no_link')
    }
  })

  it('never compares two records from the same source as an identity question', () => {
    const pairs = assessDossierBatch([janeGitHub, alexGitHub])
    expect(pairs).toEqual([])
  })
})

describe('V33.3A identity gate: no second merger exists', () => {
  it('the anchor module exposes no merge or link function', () => {
    const source = fs.readFileSync(
      path.join(path.resolve(process.cwd()), 'lib/connectors/identity-anchors-v33-3.ts'),
      'utf8',
    )
    expect(source).not.toMatch(/export function (merge|link|autoMerge|resolveIdentity)/)
    expect(source).not.toMatch(/from '.*supabase/)
    expect(source).not.toMatch(/\.from\(['"](candidates|source_profiles)['"]\)/)
  })

  it('shared code hosts are not treated as personal domains', () => {
    // If github.com counted as a personal domain, every GitHub user would
    // share a deterministic anchor with every other GitHub user.
    const anchors = janeGitHub.anchors.filter(anchor => anchor.kind === 'personal_domain')
    expect(anchors.every(anchor => anchor.normalized !== 'github.com')).toBe(true)
  })

  it('a source profile URL is a supporting anchor, not a deterministic one', () => {
    const anchor = janeStack.anchors.find(item => item.kind === 'source_profile_url')
    expect(anchor?.strength).toBe('supporting')
  })
})
