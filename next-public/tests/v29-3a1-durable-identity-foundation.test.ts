import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { buildIdentityBlockKeys } from '../lib/identity/blocking'
import { selectCanonicalField } from '../lib/identity/canonical-fields'
import { detectIdentityConflicts } from '../lib/identity/conflict-detection'
import { extractObservedIdentifiers } from '../lib/identity/identifier-extraction'
import {
  foldForComparison,
  normalizeEmail,
  normalizeName,
  normalizeOrcid,
  normalizeProfileUrl,
  sensitiveHash,
  stableHash,
} from '../lib/identity/normalization'
import { resolveCandidateIdentity } from '../lib/identity/resolver'
import { sourceRoleFor } from '../lib/identity/source-role'
import type {
  CandidateIdentity,
  IdentityIdentifier,
  IdentityProfile,
} from '../lib/identity/resolver-types'
import type { SourceName } from '../lib/source-types'

const OWNER = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const OTHER_OWNER = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const SECRET = 'fixture-secret-not-production'
const NOW = '2026-07-30T12:00:00.000Z'

function platformIdentifier(source: SourceName, sourceProfileId: string): IdentityIdentifier {
  return {
    type: 'platform_id',
    hash: stableHash(`${source}:${sourceProfileId}`),
    displayValue: sourceProfileId,
    confidence: 1,
    observedAt: NOW,
    sensitive: false,
    source,
  }
}

function emailIdentifier(source: SourceName, email: string): IdentityIdentifier {
  return {
    type: 'public_email_hash',
    hash: sensitiveHash(normalizeEmail(email), SECRET),
    confidence: 0.9,
    observedAt: NOW,
    sensitive: true,
    source,
  }
}

function orcidIdentifier(source: SourceName, orcid: string): IdentityIdentifier {
  return {
    type: 'orcid',
    hash: stableHash(normalizeOrcid(orcid)),
    displayValue: normalizeOrcid(orcid),
    confidence: 1,
    observedAt: NOW,
    sensitive: false,
    source,
  }
}

function profile(overrides: Partial<IdentityProfile> = {}): IdentityProfile {
  const source = overrides.source ?? 'github'
  const sourceProfileId = overrides.sourceProfileId ?? 'ada'
  return {
    id: overrides.id ?? `${source}:${sourceProfileId}`,
    ownerId: overrides.ownerId ?? OWNER,
    source,
    sourceProfileId,
    entityKind: overrides.entityKind ?? 'person',
    sourceRole: overrides.sourceRole ?? 'person_anchor',
    displayName: overrides.displayName ?? 'Ada Lovelace',
    headline: overrides.headline,
    location: overrides.location,
    organization: overrides.organization,
    profileUrl: overrides.profileUrl,
    websites: overrides.websites ?? [],
    handles: overrides.handles ?? [],
    publicEmails: overrides.publicEmails ?? [],
    orcid: overrides.orcid,
    explicitLinks: overrides.explicitLinks ?? [],
    identifiers: overrides.identifiers ?? [platformIdentifier(source, sourceProfileId)],
    observedAt: overrides.observedAt ?? NOW,
    chronology: overrides.chronology,
  }
}

function candidate(sourceProfile: IdentityProfile, overrides: Partial<CandidateIdentity> = {}): CandidateIdentity {
  return {
    id: overrides.id ?? '11111111-1111-4111-8111-111111111111',
    ownerId: overrides.ownerId ?? sourceProfile.ownerId,
    canonicalName: overrides.canonicalName ?? sourceProfile.displayName,
    headline: overrides.headline,
    location: overrides.location ?? sourceProfile.location,
    currentCompany: overrides.currentCompany ?? sourceProfile.organization,
    currentTitle: overrides.currentTitle,
    sourceProfiles: overrides.sourceProfiles ?? [sourceProfile],
  }
}

describe('V29.3A1 conservative normalization', () => {
  it('preserves Unicode names while producing a comparison fold', () => {
    expect(normalizeName('  José  García-López ')).toBe('josé garcía-lópez')
    expect(foldForComparison('José García-López')).toBe('jose garcia lopez')
    expect(normalizeName('王 小明')).toBe('王 小明')
  })

  it('normalizes Gmail only with provider-specific rules', () => {
    expect(normalizeEmail('A.da+jobs@googlemail.com')).toBe('ada@gmail.com')
    expect(normalizeEmail('a.da+jobs@example.com')).toBe('a.da+jobs@example.com')
  })

  it('does not collide an email with punctuation-stripped text', () => {
    expect(normalizeEmail('alex@example.com')).not.toBe('alexexample.com')
  })

  it('removes URL tracking without changing the profile path', () => {
    expect(normalizeProfileUrl('http://www.github.com/Ada/?utm_source=x#bio')).toBe('https://github.com/Ada')
  })

  it('validates ORCID checksums', () => {
    expect(normalizeOrcid('https://orcid.org/0000-0002-1825-0097')).toBe('0000-0002-1825-0097')
    expect(normalizeOrcid('0000-0002-1825-0098')).toBe('')
  })
})

describe('V29.3A1 observed identifiers and blocking', () => {
  it('hashes public emails without persisting plaintext display values', () => {
    const base = profile({ publicEmails: ['Ada@example.com'], identifiers: [] })
    const identifiers = extractObservedIdentifiers({ ...base, identifiers: undefined } as never, SECRET)
    const email = identifiers.find(identifier => identifier.type === 'public_email_hash')!
    expect(email.hash).toMatch(/^[0-9a-f]{64}$/)
    expect(email.displayValue).toBeUndefined()
    expect(JSON.stringify(email)).not.toContain('ada@example.com')
  })

  it('scopes block hashes to the owner', () => {
    const a = buildIdentityBlockKeys(profile({ location: 'London' }))
    const b = buildIdentityBlockKeys(profile({ ownerId: OTHER_OWNER, location: 'London' }))
    expect(a.map(key => key.hash)).not.toEqual(b.map(key => key.hash))
  })

  it('uses name-location only as a comparison block', () => {
    const keys = buildIdentityBlockKeys(profile({ location: 'Washington, DC', organization: 'Example' }))
    expect(keys.some(key => key.type === 'name_location')).toBe(true)
    expect(keys.some(key => key.type === 'name_organization')).toBe(true)
  })

  it('includes explicitly observed linked profile URLs in blocking', () => {
    const keys = buildIdentityBlockKeys(profile({ explicitLinks: ['https://github.com/grace'] }))
    expect(keys.filter(key => key.type === 'profile_url')).toHaveLength(1)
  })
})

describe('V29.3A1 source-role boundary', () => {
  it('admits only person anchors', () => {
    expect(sourceRoleFor({ source: 'github', entityKind: 'person' })).toBe('person_anchor')
    expect(sourceRoleFor({ source: 'arxiv', entityKind: 'publication' })).toBe('evidence_artifact')
    expect(sourceRoleFor({ source: 'npm', entityKind: 'artifact' })).toBe('evidence_artifact')
    expect(sourceRoleFor({ source: 'github', entityKind: 'organization' })).toBe('organization')
  })

  it('allows an authorized imported connection person without turning every x-ray lane into a person', () => {
    expect(sourceRoleFor({ source: 'resume_xray', entityKind: 'person', authorizedPersonImport: true })).toBe('person_anchor')
    expect(sourceRoleFor({ source: 'resume_xray', entityKind: 'search_lane' })).toBe('discovery_lane')
  })
})

describe('V29.3A1 resolver decisions', () => {
  it('reuses exact same-source stable identity idempotently', () => {
    const existing = profile({ source: 'github', sourceProfileId: 'ada' })
    const result = resolveCandidateIdentity({ incoming: profile({ source: 'github', sourceProfileId: 'ada' }), candidates: [candidate(existing)] })
    expect(result.decisionClass).toBe('exact_source_reuse')
    expect(result.safeToAttach).toBe(true)
    expect(result.reviewRequired).toBe(false)
  })

  it('deterministically links an explicit cross-profile link', () => {
    const existing = profile({ source: 'github', sourceProfileId: 'ada', profileUrl: 'https://github.com/ada' })
    const incoming = profile({
      source: 'stackoverflow',
      sourceProfileId: '42',
      profileUrl: 'https://stackoverflow.com/users/42/ada',
      explicitLinks: ['https://github.com/ada'],
    })
    const result = resolveCandidateIdentity({ incoming, candidates: [candidate(existing)] })
    expect(result.decisionClass).toBe('deterministic_attach')
    expect(result.deterministicRules.some(rule => rule.ruleId === 'explicit_cross_profile_link' && rule.passed)).toBe(true)
  })

  it('deterministically links an authorized resume containing the exact GitHub URL', () => {
    const existing = profile({ source: 'github', profileUrl: 'https://github.com/ada' })
    const incoming = profile({
      source: 'resume_xray',
      sourceProfileId: 'import-1',
      sourceRole: 'person_anchor',
      explicitLinks: ['https://github.com/ada'],
    })
    const result = resolveCandidateIdentity({ incoming, candidates: [candidate(existing)] })
    expect(result.decisionClass).toBe('deterministic_attach')
    expect(result.deterministicRules.some(rule => rule.ruleId === 'same_authorized_resume_profile_url' && rule.passed)).toBe(true)
  })

  it('deterministically links the same validated ORCID', () => {
    const orcid = '0000-0002-1825-0097'
    const existing = profile({
      source: 'openalex',
      sourceProfileId: 'A1',
      identifiers: [platformIdentifier('openalex', 'A1'), orcidIdentifier('openalex', orcid)],
    })
    const incoming = profile({
      source: 'orcid',
      sourceProfileId: orcid,
      orcid,
      identifiers: [platformIdentifier('orcid', orcid), orcidIdentifier('orcid', orcid)],
    })
    const result = resolveCandidateIdentity({ incoming, candidates: [candidate(existing)] })
    expect(result.decisionClass).toBe('deterministic_attach')
    expect(result.deterministicRules.some(rule => rule.ruleId === 'same_authenticated_or_imported_orcid' && rule.passed)).toBe(true)
  })

  it('allows the same observed public email only with a compatible name', () => {
    const existing = profile({
      source: 'github',
      publicEmails: ['ada@example.com'],
      identifiers: [platformIdentifier('github', 'ada'), emailIdentifier('github', 'ada@example.com')],
    })
    const incoming = profile({
      source: 'stackoverflow',
      sourceProfileId: '42',
      displayName: 'Ada L. Lovelace',
      publicEmails: ['ada@example.com'],
      identifiers: [platformIdentifier('stackoverflow', '42'), emailIdentifier('stackoverflow', 'ada@example.com')],
    })
    expect(resolveCandidateIdentity({ incoming, candidates: [candidate(existing)] }).decisionClass).toBe('deterministic_attach')
  })

  it('never links name, city, company, and similarity score alone', () => {
    const existing = profile({ displayName: 'Alex Smith', location: 'Washington, DC', organization: 'Booz Allen' })
    const incoming = profile({
      source: 'stackoverflow', sourceProfileId: '99', displayName: 'Alex Smith', location: 'Washington, DC', organization: 'Booz Allen',
    })
    const result = resolveCandidateIdentity({ incoming, candidates: [candidate(existing)] })
    expect(['high_priority_review', 'standard_review']).toContain(result.decisionClass)
    expect(result.safeToAttach).toBe(false)
    expect(result.reviewRequired).toBe(true)
  })

  it('blocks a different stable account on the same platform', () => {
    const existing = profile({ source: 'github', sourceProfileId: 'alex-one', displayName: 'Alex Smith', location: 'DC' })
    const incoming = profile({ source: 'github', sourceProfileId: 'alex-two', displayName: 'Alex Smith', location: 'DC' })
    const result = resolveCandidateIdentity({ incoming, candidates: [candidate(existing)] })
    expect(result.safeToAttach).toBe(false)
    expect(result.conflicts).toContainEqual(expect.objectContaining({ type: 'different_same_platform_id', severity: 'blocking' }))
  })

  it('keeps different public emails as material negative evidence rather than proof', () => {
    const existing = profile({
      displayName: 'Alex Smith', location: 'DC', publicEmails: ['one@example.com'],
      identifiers: [platformIdentifier('github', 'ada'), emailIdentifier('github', 'one@example.com')],
    })
    const incoming = profile({
      source: 'stackoverflow', sourceProfileId: '99', displayName: 'Alex Smith', location: 'DC', publicEmails: ['two@example.com'],
      identifiers: [platformIdentifier('stackoverflow', '99'), emailIdentifier('stackoverflow', 'two@example.com')],
    })
    const result = resolveCandidateIdentity({ incoming, candidates: [candidate(existing)] })
    expect(result.conflicts).toContainEqual(expect.objectContaining({ type: 'different_public_emails', severity: 'material' }))
    expect(result.decisionClass).not.toBe('do_not_link')
  })

  it('never compares across owners', () => {
    const incoming = profile({ ownerId: OWNER, location: 'London' })
    const existing = profile({ ownerId: OTHER_OWNER, location: 'London' })
    expect(resolveCandidateIdentity({ incoming, candidates: [candidate(existing)] }).decisionClass).toBe('create_new_candidate')
  })

  it('does not link a name-only record', () => {
    const existing = profile({ displayName: 'Wei Wang' })
    const incoming = profile({ source: 'stackoverflow', sourceProfileId: '2', displayName: 'Wei Wang' })
    expect(resolveCandidateIdentity({ incoming, candidates: [candidate(existing)] }).decisionClass).toBe('create_new_candidate')
  })

  it('rejects publications, artifacts, organizations, and unresolved identities', () => {
    for (const incoming of [
      profile({ source: 'arxiv', entityKind: 'publication', sourceRole: 'evidence_artifact' }),
      profile({ source: 'npm', entityKind: 'artifact', sourceRole: 'evidence_artifact' }),
      profile({ source: 'github', entityKind: 'organization', sourceRole: 'organization' }),
      profile({ source: 'orcid', entityKind: 'unknown', sourceRole: 'unresolved_identity' }),
    ]) {
      const result = resolveCandidateIdentity({ incoming, candidates: [] })
      expect(result.decisionClass).toBe('do_not_link')
      expect(result.safeToAttach).toBe(false)
    }
  })

  it('surfaces incompatible ORCIDs as a blocking conflict', () => {
    const existing = profile({ identifiers: [platformIdentifier('github', 'ada'), orcidIdentifier('github', '0000-0002-1825-0097')], location: 'London' })
    const incoming = profile({
      source: 'orcid', sourceProfileId: '0000-0001-5109-3700', location: 'London',
      identifiers: [platformIdentifier('orcid', '0000-0001-5109-3700'), orcidIdentifier('orcid', '0000-0001-5109-3700')],
    })
    const conflicts = detectIdentityConflicts(incoming, candidate(existing))
    expect(conflicts).toContainEqual(expect.objectContaining({ type: 'different_orcid', severity: 'blocking' }))
  })
})

describe('V29.3A1 field-level provenance selection', () => {
  const now = new Date('2026-07-30T12:00:00.000Z')

  it('selects a fresh GitHub skill claim over a stale imported claim', () => {
    const result = selectCanonicalField('skill', [
      {
        id: 'old', fieldName: 'skill', value: 'Java', normalizedValue: 'java', source: 'resume_xray', sourceType: 'imported_data',
        retrievedAt: '2020-01-01T00:00:00Z', lifecycleStatus: 'active', reviewerStatus: 'unreviewed',
      },
      {
        id: 'new', fieldName: 'skill', value: 'TypeScript', normalizedValue: 'typescript', source: 'github', sourceType: 'public_profile',
        retrievedAt: '2026-07-29T00:00:00Z', lifecycleStatus: 'active', reviewerStatus: 'unreviewed', corroborationCount: 2,
      },
    ], now)
    expect(result.selectedClaimId).toBe('new')
    expect(result.selectedValue).toBe('TypeScript')
  })

  it('keeps close conflicting claims visible and requires review', () => {
    const result = selectCanonicalField('current_title', [
      {
        id: 'a', fieldName: 'current_title', value: 'Director', normalizedValue: 'director', source: 'resume_xray', sourceType: 'imported_data',
        retrievedAt: '2026-07-01T00:00:00Z', lifecycleStatus: 'active', reviewerStatus: 'unreviewed', sourceReliability: 0.8,
      },
      {
        id: 'b', fieldName: 'current_title', value: 'VP', normalizedValue: 'vp', source: 'resume_xray', sourceType: 'imported_data',
        retrievedAt: '2026-07-02T00:00:00Z', lifecycleStatus: 'conflicting', reviewerStatus: 'requires_review', sourceReliability: 0.85,
      },
    ], now)
    expect(result.conflictingClaims).toHaveLength(1)
    expect(result.reviewRequired).toBe(true)
  })

  it('returns no selected value when every claim is rejected', () => {
    const result = selectCanonicalField('location', [{
      id: 'x', fieldName: 'location', value: 'Old Place', source: 'github', sourceType: 'public_profile',
      retrievedAt: NOW, lifecycleStatus: 'rejected', reviewerStatus: 'rejected',
    }], now)
    expect(result.selectedValue).toBeNull()
    expect(result.reviewRequired).toBe(true)
  })
})

describe('V29.3A1 migration contract', () => {
  const migrationPath = join(process.cwd(), 'supabase/migrations/20260730181000_durable_identity_foundation.sql')
  const migration = readFileSync(migrationPath, 'utf8').toLowerCase()

  it('keeps exactly the ordered baseline and identity migrations active', () => {
    expect(readdirSync(join(process.cwd(), 'supabase/migrations')).filter(file => file.endsWith('.sql')).sort()).toEqual([
      '20260730172500_canonical_baseline_anchor.sql',
      '20260730181000_durable_identity_foundation.sql',
    ])
  })

  it('creates every durable identity table without backfill DML', () => {
    for (const table of [
      'source_profile_snapshots', 'source_profile_identifiers', 'identity_block_keys',
      'identity_match_proposals', 'evidence_claims', 'evidence_claim_events', 'candidate_merge_events',
    ]) expect(migration).toContain(`create table if not exists public.${table}`)
    expect(migration).not.toMatch(/\b(insert into|update public\.|delete from|truncate table)\b/)
  })

  it('uses owner-safe composite foreign keys and browser read-only grants', () => {
    expect(migration).toContain('foreign key (owner_id, source_profile_id)')
    expect(migration).toContain('foreign key (owner_id, candidate_id)')
    expect(migration).toContain('references public.candidates(owner_id, id)')
    expect(migration).toContain('references public.source_profiles(owner_id, id)')
    expect(migration).not.toMatch(/grant\s+(insert|update|delete)/)
  })

  it('prevents more than one pending proposal for the same profile-candidate pair', () => {
    expect(migration).toContain('idx_identity_match_proposals_one_pending')
    expect(migration).toContain("where status = 'pending'")
  })
})
