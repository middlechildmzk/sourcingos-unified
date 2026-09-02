import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  buildCompanyEntityV36,
  buildCompanyShadowProjectionV36,
  companyAwardObservationV36,
  companyIdentifierV36,
  companyRelationshipV36,
  companyTechnologyObservationV36,
  normalizeUsaspendingRecipientV36,
  resolveCompanyIdentityV36,
} from '@/lib/company-intelligence-v36'
import type { EmploymentObservationV36 } from '@/lib/candidate-universe-v36'

function id(
  kind: 'uei' | 'cage' | 'lei' | 'cik' | 'npi2' | 'domain',
  value: string,
  reviewState: 'reviewed' | 'needs_review' | 'quarantined' = 'reviewed',
) {
  const result = companyIdentifierV36(kind, value, 'other', `fixture:${kind}:${value}`, reviewState)
  if (!result) throw new Error(`Expected identifier for ${kind}:${value}`)
  return result
}

function company(label: string, identifiers = [id('uei', 'ABC123')]) {
  return buildCompanyEntityV36({
    canonicalLabel: label,
    identifiers,
    source: 'other',
    sourceRef: `fixture:${label}`,
  })
}

function employment(input: Partial<EmploymentObservationV36> & Pick<EmploymentObservationV36, 'candidateId' | 'companyName' | 'evidenceClass'>): EmploymentObservationV36 {
  return {
    observationId: input.observationId || `employment:${input.candidateId}:${input.companyName}:${input.evidenceClass}`,
    candidateId: input.candidateId,
    companyName: input.companyName,
    title: input.title,
    evidenceClass: input.evidenceClass,
    currentState: input.currentState || 'unknown',
    source: input.source || 'fixture',
    sourceUrl: input.sourceUrl,
    observedAt: input.observedAt,
    retrievedAt: input.retrievedAt,
    conflictGroup: input.conflictGroup,
    explanation: input.explanation || 'Fixture employment observation.',
  }
}

describe('V36.1 Company Intelligence identity spine', () => {
  it('normalizes reviewed company domains but does not treat them as legal identifiers', () => {
    expect(id('domain', 'https://www.Example.COM/jobs').value).toBe('example.com')
  })

  it('resolves an exact reviewed UEI as a deterministic company match', () => {
    const result = resolveCompanyIdentityV36(
      { canonicalLabel: 'GDIT', identifiers: [id('uei', 'ABC123')] },
      { canonicalLabel: 'General Dynamics Information Technology', identifiers: [id('uei', 'ABC123')] },
    )
    expect(result.disposition).toBe('deterministic_match')
  })

  it('resolves an exact reviewed LEI as a deterministic company match', () => {
    const result = resolveCompanyIdentityV36(
      { canonicalLabel: 'Acme Holdings', identifiers: [id('lei', '549300ABC')] },
      { canonicalLabel: 'Acme Holdings LLC', identifiers: [id('lei', '549300ABC')] },
    )
    expect(result.disposition).toBe('deterministic_match')
  })

  it('does not let a shared domain auto-resolve a company identity', () => {
    const result = resolveCompanyIdentityV36(
      { canonicalLabel: 'Acme', identifiers: [id('domain', 'acme.example')] },
      { canonicalLabel: 'Acme Cloud', identifiers: [id('domain', 'acme.example')] },
    )
    expect(result.disposition).toBe('proposal_only')
  })

  it('does not let a needs-review legal identifier become merge authority', () => {
    const result = resolveCompanyIdentityV36(
      { canonicalLabel: 'Acme', identifiers: [id('uei', 'ABC123', 'needs_review')] },
      { canonicalLabel: 'Acme Inc.', identifiers: [id('uei', 'ABC123', 'needs_review')] },
    )
    expect(result.disposition).toBe('proposal_only')
  })

  it('does not let a quarantined legal identifier become merge authority', () => {
    const result = resolveCompanyIdentityV36(
      { canonicalLabel: 'Acme', identifiers: [id('cik', '0000123456', 'quarantined')] },
      { canonicalLabel: 'Acme Corp.', identifiers: [id('cik', '0000123456', 'quarantined')] },
    )
    expect(result.disposition).toBe('proposal_only')
  })

  it('blocks a reviewed UEI conflict even when names are identical', () => {
    const result = resolveCompanyIdentityV36(
      { canonicalLabel: 'Acme', identifiers: [id('uei', 'LEFT123')] },
      { canonicalLabel: 'Acme', identifiers: [id('uei', 'RIGHT456')] },
    )
    expect(result.disposition).toBe('identifier_conflict')
  })

  it('does not treat different CAGE codes alone as an identity conflict', () => {
    const result = resolveCompanyIdentityV36(
      { canonicalLabel: 'Acme', identifiers: [id('cage', '1ABC2')] },
      { canonicalLabel: 'Acme', identifiers: [id('cage', '3DEF4')] },
    )
    expect(result.disposition).toBe('proposal_only')
  })

  it('anchors the shadow entity id to a reviewed legal identifier', () => {
    const entity = company('General Dynamics Information Technology', [id('uei', 'GDIT123')])
    expect(entity.id).toContain('uei-gdit123')
    expect(entity.kind).toBe('company')
  })

  it('does not anchor an entity id to an unreviewed identifier', () => {
    const entity = company('Acme Cloud', [id('uei', 'UNVERIFIED', 'needs_review')])
    expect(entity.id).toBe('company:acme-cloud')
  })

  it('keeps a bare ambiguous company name unresolved without an identifier', () => {
    const result = resolveCompanyIdentityV36(
      { canonicalLabel: 'Amazon', identifiers: [] },
      { canonicalLabel: 'Amazon Web Services', identifiers: [] },
    )
    expect(result.disposition).toBe('proposal_only')
  })
})

describe('V36.1 USAspending-compatible hierarchy adapter', () => {
  it('normalizes a child recipient and deterministic parent UEI without flattening them', () => {
    const normalized = normalizeUsaspendingRecipientV36({
      recipient_id: '123-C',
      recipient_name: 'General Dynamics Information Technology',
      recipient_uei: 'GDITUEI',
      parent_id: '999-P',
      parent_name: 'General Dynamics Corporation',
      parent_uei: 'GDCUEI',
    })

    expect(normalized.recipientLevel).toBe('child')
    expect(normalized.entity.id).not.toBe(normalized.parent?.entity.id)
    expect(normalized.parent?.relationship.type).toBe('SUBSIDIARY_OF')
    expect(normalized.parent?.relationship.confidence).toBe('deterministic')
    expect(normalized.parent?.relationship.provenance[0].reviewState).toBe('reviewed')
  })

  it('keeps a parent-name-only hierarchy relationship reviewable', () => {
    const normalized = normalizeUsaspendingRecipientV36({
      recipient_id: '123-C',
      recipient_name: 'Child LLC',
      recipient_uei: 'CHILD123',
      parent_name: 'Parent Holdings',
    })

    expect(normalized.parent?.relationship.confidence).toBe('moderate')
    expect(normalized.parent?.relationship.provenance[0].reviewState).toBe('needs_review')
  })

  it('represents missing parent data as not reported, never independent', () => {
    const normalized = normalizeUsaspendingRecipientV36({
      recipient_id: '123-R',
      recipient_name: 'Acme Corp',
      recipient_uei: 'ACME123',
    })

    expect(normalized.parent).toBeUndefined()
    expect(normalized.parentUnknownReason).toBe('not_reported')
    expect(normalized.adapterNote.toLowerCase()).toContain('unknown')
  })

  it('parses parent and neither recipient suffixes separately', () => {
    expect(normalizeUsaspendingRecipientV36({ recipient_id: '1-P', recipient_name: 'P' }).recipientLevel).toBe('parent')
    expect(normalizeUsaspendingRecipientV36({ recipient_id: '2-R', recipient_name: 'R' }).recipientLevel).toBe('neither')
  })

  it('does not require a live external request to normalize a fixture', () => {
    const normalized = normalizeUsaspendingRecipientV36({ recipient_name: 'Offline Fixture' })
    expect(normalized.entity.canonicalLabel).toBe('Offline Fixture')
    expect(normalized.adapterNote).toContain('Shadow normalization')
  })
})

describe('V36.1 typed company relationships', () => {
  it('supports temporal former-name relationships without collapsing the two labels into aliases', () => {
    const relationship = companyRelationshipV36({
      fromEntityId: 'company:facebook',
      toEntityId: 'company:meta',
      type: 'FORMER_NAME_OF',
      source: 'sec_edgar',
      reviewState: 'reviewed',
      confidence: 'deterministic',
      note: 'Fixture filing-backed rename relation with temporal semantics handled by the caller.',
    })
    expect(relationship.type).toBe('FORMER_NAME_OF')
    expect(relationship.direction).toBe('directed')
  })

  it('keeps a business unit relationship distinct from legal subsidiary ownership', () => {
    const relationship = companyRelationshipV36({
      fromEntityId: 'company:google-cloud',
      toEntityId: 'company:google',
      type: 'BUSINESS_UNIT_OF',
      source: 'other',
      note: 'Recruiter-reviewed business-unit distinction.',
    })
    expect(relationship.type).toBe('BUSINESS_UNIT_OF')
    expect(relationship.provenance[0].reviewState).toBe('needs_review')
  })
})

describe('V36.1 company-to-candidate firewall', () => {
  const acme = company('Acme')

  it('labels company technology as discovery context only', () => {
    const observation = companyTechnologyObservationV36({
      companyEntityId: acme.id,
      technologyEntityId: 'technology:kubernetes',
      technologyLabel: 'Kubernetes',
      evidenceClass: 'company_job_posting',
      source: 'company careers site',
    })
    expect(observation.reviewState).toBe('needs_review')
    expect(observation.explanation.toLowerCase()).toContain('never creates a candidate skill')
  })

  it('labels federal award context as incapable of proving candidate clearance', () => {
    const award = companyAwardObservationV36({
      companyEntityId: acme.id,
      awardingAgency: 'Department of Defense',
      naics: '541512',
      placeOfPerformance: 'Fort Meade, MD',
      source: 'usaspending',
    })
    expect(award.explanation.toLowerCase()).toContain('never establishes candidate clearance')
  })

  it('counts profile-statement employment observations as known SourcingOS people', () => {
    const projection = buildCompanyShadowProjectionV36({
      entity: acme,
      employmentObservations: [employment({
        candidateId: 'candidate-1',
        companyName: 'Acme',
        title: 'Linux Administrator',
        evidenceClass: 'profile_statement',
      })],
    })
    expect(projection.knownCandidateCount).toBe(1)
    expect(projection.knownCandidateCountLabel).toBe('1 person known to SourcingOS')
  })

  it('counts provider assertions as observations without calling them verified employment', () => {
    const projection = buildCompanyShadowProjectionV36({
      entity: acme,
      employmentObservations: [employment({
        candidateId: 'candidate-1',
        companyName: 'Acme',
        title: 'Platform Engineer',
        evidenceClass: 'provider_assertion',
      })],
    })
    expect(projection.knownCandidateCount).toBe(1)
    expect(projection.employmentObservationCount).toBe(1)
  })

  it('does not count GitHub organization participation as employment', () => {
    const projection = buildCompanyShadowProjectionV36({
      entity: acme,
      employmentObservations: [employment({
        candidateId: 'candidate-1',
        companyName: 'Acme',
        evidenceClass: 'github_org_participation',
      })],
    })
    expect(projection.knownCandidateCount).toBe(0)
    expect(projection.employmentObservationCount).toBe(0)
  })

  it('does not count company email-domain affiliation as employment', () => {
    const projection = buildCompanyShadowProjectionV36({
      entity: acme,
      employmentObservations: [employment({
        candidateId: 'candidate-1',
        companyName: 'Acme',
        evidenceClass: 'email_domain_affiliation',
      })],
    })
    expect(projection.knownCandidateCount).toBe(0)
  })

  it('deduplicates known-talent counts by candidate while preserving observation count', () => {
    const projection = buildCompanyShadowProjectionV36({
      entity: acme,
      employmentObservations: [
        employment({ candidateId: 'candidate-1', companyName: 'Acme', evidenceClass: 'profile_statement' }),
        employment({ candidateId: 'candidate-1', companyName: 'Acme', evidenceClass: 'provider_assertion' }),
      ],
    })
    expect(projection.knownCandidateCount).toBe(1)
    expect(projection.employmentObservationCount).toBe(2)
  })

  it('counts observed titles by distinct candidate rather than duplicate observations', () => {
    const projection = buildCompanyShadowProjectionV36({
      entity: acme,
      employmentObservations: [
        employment({ candidateId: 'candidate-1', companyName: 'Acme', title: 'RHEL Administrator', evidenceClass: 'profile_statement' }),
        employment({ candidateId: 'candidate-1', companyName: 'Acme', title: 'RHEL Administrator', evidenceClass: 'provider_assertion' }),
        employment({ candidateId: 'candidate-2', companyName: 'Acme', title: 'RHEL Administrator', evidenceClass: 'profile_statement' }),
      ],
    })
    expect(projection.observedTitles).toContainEqual({ title: 'RHEL Administrator', knownCandidateCount: 2 })
  })

  it('filters company observations to the projected company entity', () => {
    const technology = companyTechnologyObservationV36({
      companyEntityId: 'company:other',
      technologyEntityId: 'technology:rhel',
      technologyLabel: 'RHEL',
      evidenceClass: 'company_published_artifact',
      source: 'GitHub',
    })
    const award = companyAwardObservationV36({
      companyEntityId: 'company:other',
      source: 'usaspending',
      awardingAgency: 'DoD',
    })
    const projection = buildCompanyShadowProjectionV36({
      entity: acme,
      technologyObservations: [technology],
      awardObservations: [award],
    })
    expect(projection.technologyObservations).toHaveLength(0)
    expect(projection.awardObservations).toHaveLength(0)
  })

  it('preserves an explicit parent-unknown reason rather than rendering independence', () => {
    const projection = buildCompanyShadowProjectionV36({
      entity: acme,
      parentUnknownReason: 'consent_not_obtained',
    })
    expect(projection.parentUnknownReason).toBe('consent_not_obtained')
  })

  it('states that prestige and brand cannot affect candidate ranking', () => {
    const projection = buildCompanyShadowProjectionV36({ entity: acme })
    expect(projection.trustBoundaries.join(' ')).toMatch(/prestige.*never affect candidate ranking/i)
    expect(projection).not.toHaveProperty('prestigeScore')
    expect(projection).not.toHaveProperty('fitScore')
  })

  it('labels known-talent counts as SourcingOS observations, not labor-market size', () => {
    const projection = buildCompanyShadowProjectionV36({
      entity: acme,
      employmentObservations: [
        employment({ candidateId: 'candidate-1', companyName: 'Acme', evidenceClass: 'profile_statement' }),
        employment({ candidateId: 'candidate-2', companyName: 'Acme', evidenceClass: 'profile_statement' }),
      ],
    })
    expect(projection.knownCandidateCountLabel).toBe('2 people known to SourcingOS')
    expect(projection.trustBoundaries.join(' ')).toMatch(/not labor-market estimates/i)
  })
})

describe('V36.1 external-data and architecture guardrails', () => {
  it('keeps the USAspending adapter offline/shadow until endpoint schema is verified', () => {
    const root = path.resolve(process.cwd())
    const source = fs.readFileSync(path.join(root, 'lib/company-intelligence-v36.ts'), 'utf8')
    expect(source).not.toMatch(/\bfetch\s*\(/)
    expect(source).toContain('primary-source verified before production fetching')
  })

  it('does not introduce a second canonical company datastore in the shadow module', () => {
    const root = path.resolve(process.cwd())
    const source = fs.readFileSync(path.join(root, 'lib/company-intelligence-v36.ts'), 'utf8')
    expect(source).not.toMatch(/company_entities|create table|insert into/i)
    expect(source).toContain("version: 'v36.1-shadow'")
  })

  it('contains no facility-clearance field or DCSA-registry assumption', () => {
    const root = path.resolve(process.cwd())
    const source = fs.readFileSync(path.join(root, 'lib/company-intelligence-v36.ts'), 'utf8')
    expect(source).not.toMatch(/facilityClearance|facility_clearance|dcsa_registry/i)
  })
})
