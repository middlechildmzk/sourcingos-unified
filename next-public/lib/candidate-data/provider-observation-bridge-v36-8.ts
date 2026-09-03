import 'server-only'
import { createHmac, timingSafeEqual } from 'node:crypto'
import type { CandidateDataProviderV36_8, CandidateProviderObservationV36_8 } from './types-v36-8'
import type { EvidenceItem, IdentitySignal, SourceName, SourceResult } from '@/lib/source-types'

const SIGNATURE_VERSION = 'v36.8'

function signingKey(provider: CandidateDataProviderV36_8): string | undefined {
  if (provider === 'pearch') return process.env.PEARCH_API_KEY
  if (provider === 'data_vertex') return process.env.DATAVERTEX_API_KEY
  if (provider === 'contactout') return process.env.CONTACTOUT_API_KEY
  if (provider === 'people_data_labs') return process.env.PDL_API_KEY || process.env.PEOPLE_DATA_LABS_API_KEY
  if (provider === 'coresignal') return process.env.CORESIGNAL_API_KEY
  if (provider === 'signalhire') return process.env.SIGNALHIRE_API_KEY
  if (provider === 'linkup') return process.env.LINKUP_API_KEY
  if (provider === 'exa') return process.env.EXA_API_KEY
  if (provider === 'openweb_ninja') return process.env.OPENWEBNINJA_API_KEY
  return undefined
}

function stableObservationPayload(observation: CandidateProviderObservationV36_8): string {
  return JSON.stringify({
    v: SIGNATURE_VERSION,
    provider: observation.provider,
    providerPersonId: observation.providerPersonId,
    displayName: observation.displayName,
    headline: observation.headline || '',
    currentTitle: observation.currentTitle || '',
    currentEmployer: observation.currentEmployer || '',
    location: observation.location || '',
    skills: [...observation.skills],
    profileUrls: observation.profileUrls.map(item => ({ kind: item.kind, url: item.url })),
    contactAvailability: observation.contactAvailability,
    providerRetrievalScore: observation.providerRetrievalScore ?? null,
    providerScoreScale: observation.providerScoreScale || '',
    providerExplanation: observation.providerExplanation || '',
    refreshedAt: observation.refreshedAt || '',
    observedAt: observation.observedAt,
  })
}

export function signProviderObservationV36_8(observation: CandidateProviderObservationV36_8): string | undefined {
  const key = signingKey(observation.provider)
  if (!key) return undefined
  return createHmac('sha256', key).update(stableObservationPayload(observation)).digest('base64url')
}

export function verifyProviderObservationV36_8(observation: CandidateProviderObservationV36_8, signature: string): boolean {
  const expected = signProviderObservationV36_8(observation)
  if (!expected || !signature) return false
  const left = Buffer.from(expected)
  const right = Buffer.from(signature)
  return left.length === right.length && timingSafeEqual(left, right)
}

function evidenceForObservation(observation: CandidateProviderObservationV36_8): EvidenceItem[] {
  const source = observation.provider as SourceName
  const observedAt = observation.observedAt
  const observedProfileUrl = observation.profileUrls[0]?.url
  const items: EvidenceItem[] = []
  if (observation.currentTitle || observation.headline) {
    items.push({ id: `${source}:${observation.providerPersonId}:role`, label: `${source} profile observation`, detail: `Professional profile lists role: ${observation.currentTitle || observation.headline}.`, source, confidence: 'medium', url: observedProfileUrl, observedAt })
  }
  if (observation.currentEmployer) {
    items.push({ id: `${source}:${observation.providerPersonId}:employer`, label: `${source} employer observation`, detail: `Professional profile lists current employer: ${observation.currentEmployer}.`, source, confidence: 'medium', url: observedProfileUrl, observedAt })
  }
  for (const skill of observation.skills.slice(0, 20)) {
    items.push({ id: `${source}:${observation.providerPersonId}:skill:${skill.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`, label: `${source} skill observation`, detail: `Professional profile lists skill: ${skill}.`, source, confidence: 'medium', url: observedProfileUrl, observedAt })
  }
  return items
}

export function providerObservationToSourceResultV36_8(observation: CandidateProviderObservationV36_8): SourceResult {
  const source = observation.provider as SourceName

  // Commercial/provider-index rows often report third-party professional URLs.
  // Those links belong to the observed person, not to the provider source row
  // itself. Preserve them as profile_url signals and evidence citations, but do
  // not assign them to SourceResult.profileUrl or source_url identity authority.
  // This prevents a LinkedIn/GitHub URL returned by a vendor from being treated
  // as a source-native profile link by older identity-resolution code.
  const identitySignals: IdentitySignal[] = [
    { type: 'name', value: observation.displayName, weight: 0.5, source },
    ...(observation.location ? [{ type: 'location' as const, value: observation.location, weight: 0.2, source }] : []),
    ...(observation.currentEmployer ? [{ type: 'organization' as const, value: observation.currentEmployer, weight: 0.2, source }] : []),
  ]

  return {
    id: `${source}:${observation.providerPersonId}`,
    source,
    sourceProfileId: observation.providerPersonId,
    entityKind: 'person',
    displayName: observation.displayName,
    headline: observation.currentTitle || observation.headline,
    location: observation.location,
    organization: observation.currentEmployer,
    profileUrl: undefined,
    skills: [...observation.skills],
    evidence: evidenceForObservation(observation),
    contactSignals: observation.profileUrls.slice(0, 10).map(item => ({
      type: 'profile_url' as const,
      value: item.url,
      source,
      verified: false as const,
      note: `Provider-observed ${item.kind} profile URL. This is a provenance/identity-review signal, not deterministic merge authority or outreach permission.`,
    })),
    identitySignals,
    refreshedAt: observation.refreshedAt || observation.observedAt,
    raw: {
      resolver: 'candidate_data_provider_v36_8',
      provider: observation.provider,
      providerPersonId: observation.providerPersonId,
      providerRetrievalScore: observation.providerRetrievalScore,
      providerScoreScale: observation.providerScoreScale,
      providerExplanation: observation.providerExplanation,
      contactAvailability: observation.contactAvailability,
      observedProfileUrls: observation.profileUrls,
      observationNote: 'Commercial/provider-index observation; recruiter verification remains required for qualification and cross-source identity claims.',
    },
  }
}

export type SignedProviderObservationV36_8 = {
  observation: CandidateProviderObservationV36_8
  observationSignature: string
  sourceResult: SourceResult
}

export function signedProviderObservationV36_8(observation: CandidateProviderObservationV36_8): SignedProviderObservationV36_8 | undefined {
  const observationSignature = signProviderObservationV36_8(observation)
  if (!observationSignature) return undefined
  return { observation, observationSignature, sourceResult: providerObservationToSourceResultV36_8(observation) }
}
