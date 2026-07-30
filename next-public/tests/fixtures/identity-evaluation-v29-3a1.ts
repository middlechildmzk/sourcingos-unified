import type { LabeledIdentityCase } from '../../lib/identity/evaluation'
import { normalizeEmail, normalizeOrcid, sensitiveHash, stableHash } from '../../lib/identity/normalization'
import type { CandidateIdentity, IdentityIdentifier, IdentityProfile } from '../../lib/identity/resolver-types'
import type { SourceName } from '../../lib/source-types'

const OWNER = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const OTHER = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const SECRET = 'evaluation-secret-not-production'
const NOW = '2026-07-30T12:00:00.000Z'

function platform(source: SourceName, id: string): IdentityIdentifier {
  return { type: 'platform_id', hash: stableHash(`${source}:${id}`), displayValue: id, confidence: 1, observedAt: NOW, sensitive: false, source }
}
function email(source: SourceName, value: string): IdentityIdentifier {
  return { type: 'public_email_hash', hash: sensitiveHash(normalizeEmail(value), SECRET), confidence: 0.9, observedAt: NOW, sensitive: true, source }
}
function orcid(source: SourceName, value: string): IdentityIdentifier {
  return { type: 'orcid', hash: stableHash(normalizeOrcid(value)), displayValue: normalizeOrcid(value), confidence: 1, observedAt: NOW, sensitive: false, source }
}
function profile(overrides: Partial<IdentityProfile> & { source?: SourceName; sourceProfileId?: string } = {}): IdentityProfile {
  const source = overrides.source ?? 'github'
  const sourceProfileId = overrides.sourceProfileId ?? 'default-user'
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
    identifiers: overrides.identifiers ?? [platform(source, sourceProfileId)],
    observedAt: overrides.observedAt ?? NOW,
    chronology: overrides.chronology,
  }
}
function candidate(p: IdentityProfile, overrides: Partial<CandidateIdentity> = {}): CandidateIdentity {
  return {
    id: overrides.id ?? `candidate-${p.sourceProfileId}`,
    ownerId: overrides.ownerId ?? p.ownerId,
    canonicalName: overrides.canonicalName ?? p.displayName,
    headline: overrides.headline,
    location: overrides.location ?? p.location,
    currentCompany: overrides.currentCompany ?? p.organization,
    currentTitle: overrides.currentTitle,
    sourceProfiles: overrides.sourceProfiles ?? [p],
  }
}
function caseOf(
  id: string,
  description: string,
  incoming: IdentityProfile,
  candidates: CandidateIdentity[],
  expected: LabeledIdentityCase['expected'],
  cohort: string,
): LabeledIdentityCase {
  return { id, description, input: { incoming, candidates }, expected, cohort }
}

const githubAda = profile({ source: 'github', sourceProfileId: 'ada', displayName: 'Ada Lovelace', profileUrl: 'https://github.com/ada' })
const sharedOrcid = '0000-0002-1825-0097'

export const IDENTITY_EVALUATION_CASES: LabeledIdentityCase[] = [
  caseOf('exact-source', 'Exact GitHub stable ID reuse', profile({ source: 'github', sourceProfileId: 'ada' }), [candidate(githubAda)], 'exact_source_reuse', 'exact'),
  caseOf('explicit-link', 'Stack Overflow explicitly links GitHub', profile({ source: 'stackoverflow', sourceProfileId: '42', explicitLinks: ['https://github.com/ada'] }), [candidate(githubAda)], 'deterministic_attach', 'explicit_anchor'),
  caseOf('resume-profile-url', 'Authorized imported resume contains exact GitHub URL', profile({ source: 'resume_xray', sourceProfileId: 'resume-1', sourceRole: 'person_anchor', explicitLinks: ['https://github.com/ada'] }), [candidate(githubAda)], 'deterministic_attach', 'explicit_anchor'),
  caseOf('shared-orcid', 'Named ORCID and OpenAlex share validated ORCID', profile({ source: 'orcid', sourceProfileId: sharedOrcid, orcid: sharedOrcid, identifiers: [platform('orcid', sharedOrcid), orcid('orcid', sharedOrcid)] }), [candidate(profile({ source: 'openalex', sourceProfileId: 'A1', identifiers: [platform('openalex', 'A1'), orcid('openalex', sharedOrcid)] }))], 'deterministic_attach', 'registry'),
  caseOf('shared-email', 'Observed public email and compatible name', profile({ source: 'stackoverflow', sourceProfileId: '77', displayName: 'Ada L. Lovelace', publicEmails: ['ada@example.com'], identifiers: [platform('stackoverflow', '77'), email('stackoverflow', 'ada@example.com')] }), [candidate(profile({ source: 'github', sourceProfileId: 'ada-mail', publicEmails: ['ada@example.com'], identifiers: [platform('github', 'ada-mail'), email('github', 'ada@example.com')] }))], 'deterministic_attach', 'email_anchor'),

  caseOf('same-name-prime', 'Same common name at same prime and metro', profile({ source: 'stackoverflow', sourceProfileId: 'a2', displayName: 'Alex Smith', location: 'Washington, DC', organization: 'Booz Allen' }), [candidate(profile({ source: 'github', sourceProfileId: 'a1', displayName: 'Alex Smith', location: 'Washington, DC', organization: 'Booz Allen' }))], 'review', 'common_name'),
  caseOf('chinese-common-name', 'Common Chinese name and same city', profile({ source: 'stackoverflow', sourceProfileId: 'wang2', displayName: '王伟', location: 'Beijing' }), [candidate(profile({ source: 'github', sourceProfileId: 'wang1', displayName: '王伟', location: 'Beijing' }))], 'review', 'international_common_name'),
  caseOf('indian-common-name', 'Common Indian name and same employer', profile({ source: 'stackoverflow', sourceProfileId: 'patel2', displayName: 'Rahul Patel', organization: 'Infosys' }), [candidate(profile({ source: 'github', sourceProfileId: 'patel1', displayName: 'Rahul Patel', organization: 'Infosys' }))], 'review', 'international_common_name'),
  caseOf('spanish-common-name', 'Common Spanish name and same location', profile({ source: 'stackoverflow', sourceProfileId: 'garcia2', displayName: 'María García', location: 'Madrid' }), [candidate(profile({ source: 'github', sourceProfileId: 'garcia1', displayName: 'María García', location: 'Madrid' }))], 'review', 'international_common_name'),
  caseOf('diacritic-review', 'Diacritic variation without strong anchor', profile({ source: 'stackoverflow', sourceProfileId: 'jose2', displayName: 'Jose Garcia Lopez', location: 'Barcelona' }), [candidate(profile({ source: 'github', sourceProfileId: 'jose1', displayName: 'José García-López', location: 'Barcelona' }))], 'review', 'name_variation'),
  caseOf('missing-middle-review', 'Missing middle name without strong anchor', profile({ source: 'stackoverflow', sourceProfileId: 'kim2', displayName: 'Min Kim', organization: 'Samsung' }), [candidate(profile({ source: 'github', sourceProfileId: 'kim1', displayName: 'Min J. Kim', organization: 'Samsung' }))], 'review', 'name_variation'),
  caseOf('name-change-review', 'Possible name change with shared organization but no anchor', profile({ source: 'stackoverflow', sourceProfileId: 'lee2', displayName: 'Jordan Lee', organization: 'Acme' }), [candidate(profile({ source: 'github', sourceProfileId: 'lee1', displayName: 'Jordan Rivera', organization: 'Acme' }))], 'review', 'name_variation'),
  caseOf('same-city-different-name', 'Same city alone', profile({ source: 'stackoverflow', sourceProfileId: 'city2', displayName: 'Grace Hopper', location: 'New York' }), [candidate(profile({ source: 'github', sourceProfileId: 'city1', displayName: 'Alan Turing', location: 'New York' }))], 'create_new_candidate', 'weak_overlap'),
  caseOf('same-employer-different-name', 'Same employer alone', profile({ source: 'stackoverflow', sourceProfileId: 'org2', displayName: 'Grace Hopper', organization: 'Microsoft' }), [candidate(profile({ source: 'github', sourceProfileId: 'org1', displayName: 'Alan Turing', organization: 'Microsoft' }))], 'create_new_candidate', 'weak_overlap'),
  caseOf('name-only', 'Exact name only', profile({ source: 'stackoverflow', sourceProfileId: 'name2', displayName: 'Wei Wang' }), [candidate(profile({ source: 'github', sourceProfileId: 'name1', displayName: 'Wei Wang' }))], 'create_new_candidate', 'sparse'),
  caseOf('cross-owner', 'Identical profile under another tenant', profile({ ownerId: OWNER, location: 'London' }), [candidate(profile({ ownerId: OTHER, location: 'London' }))], 'create_new_candidate', 'tenant_isolation'),
  caseOf('same-platform-different-id', 'Different GitHub IDs with same name and city', profile({ source: 'github', sourceProfileId: 'alex2', displayName: 'Alex Smith', location: 'DC' }), [candidate(profile({ source: 'github', sourceProfileId: 'alex1', displayName: 'Alex Smith', location: 'DC' }))], 'review', 'conflict'),
  caseOf('different-emails', 'Different public emails remain reviewable negative evidence', profile({ source: 'stackoverflow', sourceProfileId: 'mail2', displayName: 'Alex Smith', location: 'DC', publicEmails: ['two@example.com'], identifiers: [platform('stackoverflow', 'mail2'), email('stackoverflow', 'two@example.com')] }), [candidate(profile({ source: 'github', sourceProfileId: 'mail1', displayName: 'Alex Smith', location: 'DC', publicEmails: ['one@example.com'], identifiers: [platform('github', 'mail1'), email('github', 'one@example.com')] }))], 'review', 'conflict'),
  caseOf('different-websites', 'Different personal sites remain reviewable negative evidence', profile({ source: 'stackoverflow', sourceProfileId: 'site2', displayName: 'Alex Smith', location: 'DC', websites: ['https://alex-two.example'] }), [candidate(profile({ source: 'github', sourceProfileId: 'site1', displayName: 'Alex Smith', location: 'DC', websites: ['https://alex-one.example'] }))], 'review', 'conflict'),
  caseOf('different-orcid', 'Different ORCID identifiers block deterministic linking', profile({ source: 'orcid', sourceProfileId: '0000-0001-5109-3700', location: 'London', identifiers: [platform('orcid', '0000-0001-5109-3700'), orcid('orcid', '0000-0001-5109-3700')] }), [candidate(profile({ source: 'openalex', sourceProfileId: 'A2', location: 'London', identifiers: [platform('openalex', 'A2'), orcid('openalex', sharedOrcid)] }))], 'review', 'conflict'),
  caseOf('publication', 'Publication is evidence, not a person', profile({ source: 'arxiv', entityKind: 'publication', sourceRole: 'evidence_artifact' }), [], 'do_not_link', 'non_person'),
  caseOf('package', 'Package is evidence, not a person', profile({ source: 'npm', entityKind: 'artifact', sourceRole: 'evidence_artifact' }), [], 'do_not_link', 'non_person'),
  caseOf('organization', 'Organization is not a candidate person', profile({ source: 'github', entityKind: 'organization', sourceRole: 'organization' }), [], 'do_not_link', 'non_person'),
  caseOf('numeric-orcid', 'Identifier-only ORCID remains unresolved', profile({ source: 'orcid', sourceProfileId: sharedOrcid, entityKind: 'unknown', sourceRole: 'unresolved_identity' }), [], 'do_not_link', 'non_person'),
]
