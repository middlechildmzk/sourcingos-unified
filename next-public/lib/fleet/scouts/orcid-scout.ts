/**
 * ORCID Scout (Fleet 1) - researcher identity registry.
 *
 * Source: the ORCID Public API v3.0 at pub.orcid.org.
 *
 * ORCID matters to SourcingOS for a reason unrelated to volume. It is the
 * cleanest cross-source identity bridge that exists for research and clinical
 * talent: a persistent identifier the person owns, which they attach to their
 * own papers, datasets, GitHub account, and personal site. `orcid` is already a
 * deterministic anchor kind in the V33.3 contract, and until now nothing
 * produced one.
 *
 * Auth posture, verified rather than assumed. Public record data needs no
 * token, and sending an *invalid* token returns 401. So the connector omits
 * the Authorization header entirely when no credential is configured rather
 * than sending an empty bearer, which would break a call that would otherwise
 * have succeeded. ORCID recommends registering a free public client for
 * request priority, so a token is supported and optional.
 *
 * The distinction this connector exists to preserve
 * --------------------------------------------------
 * ORCID records who asserted each affiliation. An employment the researcher
 * typed in themselves and an employment written by the institution's own
 * system are both "employment" in the JSON, and they are not the same
 * evidence. The second is an organization confirming someone works there. The
 * first is a person's own claim about themselves, with the same standing as a
 * LinkedIn headline.
 *
 * Flattening those two into "current employer" would manufacture verification
 * that ORCID never performed. They are kept distinct all the way through, and
 * the assertion source is named on every affiliation.
 *
 * The limit that matters most
 * ---------------------------
 * ORCID records are self-maintained and frequently stale. An employment with
 * no end date means the researcher never entered one, not that they still work
 * there. Records untouched for years routinely show a job the person left. The
 * dossier says this explicitly rather than presenting an open-ended affiliation
 * as current.
 */

import {
  newRunReport,
  observedTechnology,
  retrievalTermText,
  type DiscoveryIntent,
  type DossierLimit,
  type IdentityAnchor,
  type ObservationProvenance,
  type ObservedTechnology,
  type TechnicalArtifact,
  type TechnicalDossier,
} from '../../connectors/contract-v33-3'
import { ConnectorRequestLedger } from '../../connectors/request-ledger-v33-3'
import { OPERATION_CREDIT_COST } from '../credit-ledger'
import { dossierToRawRecord } from './github-scout'
import type { ScoutAgent, ScoutDeps, ScoutResult } from '../types'

const ORCID_API = 'https://pub.orcid.org/v3.0'

/* ------------------------------------------------------------------ *
 * Payload shapes (ORCID Public API v3.0)
 * ------------------------------------------------------------------ */

type OrcidValue = { value?: string } | null | undefined

export type OrcidExpandedResult = {
  'orcid-id'?: string
  'given-names'?: string
  'family-names'?: string
  'credit-name'?: string
  'institution-name'?: string[]
}

export type OrcidExpandedSearch = {
  'expanded-result'?: OrcidExpandedResult[] | null
  'num-found'?: number
}

export type OrcidSource = {
  'source-name'?: OrcidValue
  'source-orcid'?: { path?: string } | null
  'assertion-origin-name'?: OrcidValue
  'assertion-origin-orcid'?: { path?: string } | null
}

export type OrcidEmploymentSummary = {
  'put-code'?: number
  'role-title'?: string | null
  'department-name'?: string | null
  organization?: {
    name?: string
    address?: { city?: string | null; region?: string | null; country?: string | null } | null
  } | null
  'start-date'?: { year?: OrcidValue } | null
  'end-date'?: { year?: OrcidValue } | null
  source?: OrcidSource | null
}

export type OrcidAffiliationGroup = {
  summaries?: Array<{ 'employment-summary'?: OrcidEmploymentSummary }> | null
}

export type OrcidWorkSummary = {
  'put-code'?: number
  title?: { title?: OrcidValue } | null
  type?: string | null
  'publication-date'?: { year?: OrcidValue } | null
  url?: OrcidValue
}

export type OrcidRecord = {
  'orcid-identifier'?: { path?: string; uri?: string } | null
  person?: {
    name?: {
      'given-names'?: OrcidValue
      'family-name'?: OrcidValue
      'credit-name'?: OrcidValue
    } | null
    biography?: { content?: string | null } | null
    'researcher-urls'?: {
      'researcher-url'?: Array<{ 'url-name'?: string | null; url?: OrcidValue }> | null
    } | null
    keywords?: { keyword?: Array<{ content?: string | null }> | null } | null
    'external-identifiers'?: {
      'external-identifier'?: Array<{
        'external-id-type'?: string | null
        'external-id-value'?: string | null
        'external-id-url'?: OrcidValue
      }> | null
    } | null
  } | null
  'activities-summary'?: {
    employments?: { 'affiliation-group'?: OrcidAffiliationGroup[] | null } | null
    works?: { group?: Array<{ 'work-summary'?: OrcidWorkSummary[] | null }> | null } | null
  } | null
}

const readValue = (value: OrcidValue): string => String(value?.value || '').trim()

/* ------------------------------------------------------------------ *
 * Assertion origin
 * ------------------------------------------------------------------ */

export type AffiliationAssertion =
  /** The researcher entered this about themselves. A claim, not a check. */
  | { kind: 'self_asserted' }
  /** An organization's own system wrote this record. */
  | { kind: 'organization_asserted'; assertedBy: string }

/**
 * Decide who asserted an affiliation.
 *
 * When the source ORCID equals the record's own ORCID, the researcher entered
 * it. Otherwise a third party did, and that party is named. Anything
 * ambiguous is treated as self-asserted, because the failure that matters is
 * presenting a self-claim as an institutional confirmation, never the reverse.
 */
export function classifyAssertion(
  source: OrcidSource | null | undefined,
  recordOrcid: string,
): AffiliationAssertion {
  const sourceOrcid = String(source?.['source-orcid']?.path || '').trim()
  const sourceName = readValue(source?.['source-name'])

  if (!sourceOrcid && !sourceName) return { kind: 'self_asserted' }
  if (sourceOrcid && sourceOrcid === recordOrcid) return { kind: 'self_asserted' }
  if (!sourceName) return { kind: 'self_asserted' }

  return { kind: 'organization_asserted', assertedBy: sourceName }
}

/** ORCID iDs are 16 digits in four hyphenated groups; the last may be 'X'. */
export function isValidOrcid(value: string): boolean {
  return /^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/.test(String(value || '').trim().toUpperCase())
}

/* ------------------------------------------------------------------ *
 * Dossier construction
 * ------------------------------------------------------------------ */

function provenance(
  sourceField: string,
  sourceRecordId: string,
  observedAt: string,
  basis: ObservationProvenance['basis'],
  url?: string,
): ObservationProvenance {
  return { source: 'orcid', sourceField, sourceRecordId, basis, url, observedAt }
}

function affiliationLocation(employment: OrcidEmploymentSummary): string | undefined {
  const address = employment.organization?.address
  if (!address) return undefined
  const parts = [address.city, address.region, address.country]
    .map(part => String(part || '').trim())
    .filter(Boolean)
  return parts.length ? parts.join(', ') : undefined
}

export function buildOrcidDossier(input: {
  record: OrcidRecord
  observedAt: string
}): TechnicalDossier | null {
  const { record, observedAt } = input

  const orcid = String(record['orcid-identifier']?.path || '').trim().toUpperCase()
  if (!isValidOrcid(orcid)) return null

  const profileUrl = record['orcid-identifier']?.uri || `https://orcid.org/${orcid}`
  const person = record.person || {}

  const displayName =
    readValue(person.name?.['credit-name']) ||
    [readValue(person.name?.['given-names']), readValue(person.name?.['family-name'])]
      .filter(Boolean)
      .join(' ')

  if (!displayName) return null

  const artifacts: TechnicalArtifact[] = []
  const technologies: ObservedTechnology[] = []
  const anchors: IdentityAnchor[] = []
  const websites: string[] = []

  /* -------- Employments -------- */

  let currentAffiliation: string | undefined
  let currentAffiliationLocation: string | undefined
  let organizationAssertedCount = 0
  let openEndedCount = 0

  const groups = record['activities-summary']?.employments?.['affiliation-group'] || []
  for (const group of groups) {
    for (const summary of group.summaries || []) {
      const employment = summary['employment-summary']
      if (!employment) continue

      const organization = String(employment.organization?.name || '').trim()
      if (!organization) continue

      const assertion = classifyAssertion(employment.source, orcid)
      const startYear = readValue(employment['start-date']?.year)
      const endYear = readValue(employment['end-date']?.year)
      const isOpenEnded = !endYear
      if (isOpenEnded) openEndedCount += 1
      if (assertion.kind === 'organization_asserted') organizationAssertedCount += 1

      const role = String(employment['role-title'] || '').trim()
      const department = String(employment['department-name'] || '').trim()

      // The statement names who asserted it. A reader should never have to
      // guess whether an institution confirmed this or the person typed it.
      const statement =
        assertion.kind === 'organization_asserted'
          ? `${assertion.assertedBy} recorded this affiliation with ${organization}${role ? ` as ${role}` : ''}.`
          : `The researcher recorded this affiliation with ${organization}${role ? ` as ${role}` : ''} themselves. ORCID did not verify it.`

      artifacts.push({
        artifactId: `orcid:employment:${orcid}:${employment['put-code'] ?? organization}`,
        source: 'orcid',
        type: 'professional_affiliation',
        name: role ? `${role}, ${organization}` : organization,
        url: profileUrl,
        description: department || undefined,
        statement,
        // 'author' means the record exists and says this. It is not a claim
        // that the affiliation is current or was checked by anyone.
        relationship: 'author',
        technologies: [],
        metrics: [],
        createdAt: startYear ? `${startYear}-01-01` : undefined,
        updatedAt: endYear ? `${endYear}-12-31` : undefined,
        observedAt,
      })

      // Only an organization-asserted, open-ended affiliation is worth
      // surfacing as the person's stated current employer, and even that is
      // qualified by the staleness limit below.
      if (!currentAffiliation && isOpenEnded && assertion.kind === 'organization_asserted') {
        currentAffiliation = organization
        currentAffiliationLocation = affiliationLocation(employment)
      }
    }
  }

  /* -------- Works -------- */

  const workGroups = record['activities-summary']?.works?.group || []
  let workCount = 0
  for (const group of workGroups) {
    for (const work of group['work-summary'] || []) {
      const title = readValue(work.title?.title)
      if (!title) continue
      workCount += 1
      if (artifacts.length >= 60) break

      artifacts.push({
        artifactId: `orcid:work:${orcid}:${work['put-code'] ?? title}`,
        source: 'orcid',
        type: 'publication',
        name: title,
        url: readValue(work.url) || profileUrl,
        statement: `Listed on this ORCID record as a work of type ${work.type || 'unspecified'}.`,
        relationship: 'author',
        technologies: [],
        metrics: [],
        createdAt: readValue(work['publication-date']?.year)
          ? `${readValue(work['publication-date']?.year)}-01-01`
          : undefined,
        observedAt,
      })
    }
  }

  /* -------- Keywords as self-stated expertise -------- */

  for (const keyword of person.keywords?.keyword || []) {
    const content = String(keyword.content || '').trim()
    if (!content) continue
    const tech = observedTechnology(
      content,
      provenance('person.keywords.keyword', orcid, observedAt, 'source_stated', profileUrl),
    )
    if (tech && !technologies.some(item => item.value.toLowerCase() === tech.value.toLowerCase())) {
      technologies.push(tech)
    }
  }

  /* -------- Identity anchors -------- */

  anchors.push({
    kind: 'orcid',
    value: orcid,
    normalized: orcid.toLowerCase(),
    strength: 'deterministic',
    provenance: provenance('orcid-identifier.path', orcid, observedAt, 'observed_artifact', profileUrl),
  })

  for (const researcherUrl of person['researcher-urls']?.['researcher-url'] || []) {
    const url = readValue(researcherUrl.url)
    if (!url) continue
    websites.push(url)

    // A GitHub link the researcher put on their own ORCID record is a
    // person-specific pointer, not a resemblance.
    const githubMatch = url.match(/^https?:\/\/(?:www\.)?github\.com\/([A-Za-z0-9-]+)\/?$/i)
    if (githubMatch) {
      anchors.push({
        kind: 'github_login',
        value: githubMatch[1],
        normalized: githubMatch[1].toLowerCase(),
        strength: 'deterministic',
        provenance: provenance(
          'person.researcher-urls.researcher-url',
          orcid,
          observedAt,
          'source_stated',
          profileUrl,
        ),
      })
    }
  }

  for (const external of person['external-identifiers']?.['external-identifier'] || []) {
    const type = String(external['external-id-type'] || '').trim()
    const value = String(external['external-id-value'] || '').trim()
    if (!type || !value) continue

    anchors.push({
      kind: 'explicit_profile_link',
      value: `${type}:${value}`,
      normalized: `${type.toLowerCase()}:${value.toLowerCase()}`,
      strength: 'supporting',
      provenance: provenance(
        'person.external-identifiers.external-identifier',
        orcid,
        observedAt,
        'source_stated',
        profileUrl,
      ),
    })
  }

  anchors.push({
    kind: 'source_profile_url',
    value: profileUrl,
    normalized: `orcid_profile:${orcid.toLowerCase()}`,
    strength: 'supporting',
    provenance: provenance('orcid-identifier.uri', orcid, observedAt, 'observed_artifact', profileUrl),
  })

  /* -------- Limits -------- */

  const limits: DossierLimit[] = [
    {
      topic: 'Record freshness',
      explanation:
        'ORCID records are maintained by the researcher. An affiliation with no end date means no end date was entered, not that the person still works there. Records untouched for years routinely show a role the person has left.',
    },
    {
      topic: 'Coverage',
      explanation:
        'ORCID records only what the researcher chose to add. Absent publications, employments, or keywords are silence, not evidence that the work does not exist.',
    },
    {
      topic: 'Seniority',
      explanation:
        'A role title on an affiliation is text the asserting party entered. ORCID applies no title taxonomy and validates no seniority.',
    },
  ]

  if (!organizationAssertedCount && openEndedCount) {
    limits.push({
      topic: 'Employer verification',
      explanation:
        'Every affiliation on this record was entered by the researcher. No institution confirmed any of them, so employer here has the same standing as a self-written profile headline.',
    })
  }

  if (!workCount) {
    limits.push({
      topic: 'Publications',
      explanation: 'This record lists no works. Many researchers never populate the works section.',
    })
  }

  return {
    source: 'orcid',
    person: {
      source: 'orcid',
      sourceProfileId: orcid,
      profileUrl,
      displayName,
      headline: String(person.biography?.content || '').trim().slice(0, 280) || undefined,
      // Only set when an organization asserted it, and even then the freshness
      // limit above applies.
      statedOrganization: currentAffiliation,
      statedLocation: currentAffiliationLocation,
      websites,
    },
    artifacts,
    technologies,
    anchors,
    activity: { activeYears: [] },
    limits,
    observedAt,
    raw: {
      orcid,
      employmentCount: groups.length,
      organizationAssertedCount,
      workCount,
    },
  }
}

/* ------------------------------------------------------------------ *
 * Scout
 * ------------------------------------------------------------------ */

/**
 * Headers for a public ORCID call.
 *
 * No Authorization header when no token is configured. ORCID rejects an
 * invalid bearer with 401, so sending an empty one would break a request that
 * needs no credential at all.
 */
export function orcidHeaders(token?: string): Record<string, string> {
  const headers: Record<string, string> = { accept: 'application/json' }
  const trimmed = String(token || '').trim()
  if (trimmed) headers.authorization = `Bearer ${trimmed}`
  return headers
}

export function buildOrcidSearchQuery(intent: DiscoveryIntent): string {
  const terms = intent.capabilityTerms
    .map(retrievalTermText)
    .map(term => term.trim())
    .filter(Boolean)

  const hypothesis = retrievalTermText(intent.hypothesis).trim()
  const source = terms.length ? terms.slice(0, 4) : hypothesis.split(/\s+/).filter(Boolean).slice(0, 4)
  if (!source.length) return ''

  // ORCID indexes keywords and other-names in `text:`; a quoted OR set keeps
  // multi-word specialties intact.
  return source.map(term => `"${term.replace(/"/g, '')}"`).join(' OR ')
}

export type OrcidScoutOptions = {
  /** Optional free public API token. Improves request priority, never required. */
  token?: string
  maxPeople?: number
  fetchImpl?: typeof fetch
}

export function createOrcidScout(options: OrcidScoutOptions = {}): ScoutAgent {
  return {
    key: 'scout.orcid',
    source: 'orcid',
    label: 'ORCID',

    async run(intent: DiscoveryIntent, deps: ScoutDeps): Promise<ScoutResult> {
      const startedAt = Date.now()
      const runId = intent.runId || `run_${startedAt.toString(36)}`
      const report = newRunReport('orcid')
      const observedAt = deps.now?.() || new Date().toISOString()

      const query = buildOrcidSearchQuery(intent)
      if (!query) {
        report.partial = true
        report.warnings.push(
          'No usable ORCID query could be derived from this intent. That is a query limitation, not an absence of researchers.',
        )
        report.durationMs = Date.now() - startedAt
        return {
          source: 'orcid',
          runId,
          dossiers: [],
          rawRecords: [],
          report,
          landingPath: null,
          creditsSpent: 0,
          haltReason: null,
        }
      }

      const limit = Math.max(1, Math.min(options.maxPeople ?? intent.limit, 25))
      const estimated = OPERATION_CREDIT_COST.source_discovery * limit

      const reservation = await deps.credits.reserve({
        runId,
        operation: 'source_discovery',
        source: 'orcid',
        estimatedCredits: estimated,
      })

      if (!reservation.granted) {
        report.partial = true
        report.warnings.push(`Halted before calling ORCID: budget could not cover ${estimated} credits.`)
        return {
          source: 'orcid',
          runId,
          dossiers: [],
          rawRecords: [],
          report,
          landingPath: null,
          creditsSpent: 0,
          haltReason: 'budget_exhausted',
        }
      }

      const ledger = new ConnectorRequestLedger({
        sourceKey: 'orcid',
        report,
        fetchImpl: options.fetchImpl,
        headers: orcidHeaders(options.token),
      })

      const dossiers: TechnicalDossier[] = []
      let haltReason: ScoutResult['haltReason'] = null

      try {
        const search = await ledger.json<OrcidExpandedSearch>(
          `orcid:search:${query}:${limit}`,
          `${ORCID_API}/expanded-search/?q=${encodeURIComponent(query)}&rows=${limit}`,
        )

        const hits = (search?.['expanded-result'] || []).filter(hit =>
          isValidOrcid(String(hit['orcid-id'] || '')),
        )

        for (const hit of hits) {
          const orcid = String(hit['orcid-id']).trim().toUpperCase()
          try {
            const record = await ledger.json<OrcidRecord>(
              `orcid:record:${orcid}`,
              `${ORCID_API}/${orcid}/record`,
            )
            const dossier = buildOrcidDossier({ record, observedAt })
            if (dossier) dossiers.push(dossier)
          } catch (error) {
            // One unreadable record must not fail the run. Note it and move on.
            report.warnings.push(
              `ORCID record ${orcid} could not be read: ${
                error instanceof Error ? error.message : String(error)
              }`,
            )
            report.partial = true
          }
        }
      } catch (error) {
        report.apiErrors += 1
        report.partial = true
        report.warnings.push(
          `ORCID discovery failed: ${error instanceof Error ? error.message : String(error)}`,
        )
        haltReason = 'source_error'
      }

      const actualCredits = OPERATION_CREDIT_COST.source_discovery * dossiers.length
      await deps.credits.settle({
        reservationId: reservation.reservationId,
        actualCredits,
        succeeded: haltReason === null,
      })

      const rawRecords = dossiers.map(dossier => dossierToRawRecord(dossier, intent, runId))
      let landingPath: string | null = null
      if (rawRecords.length) {
        try {
          landingPath = await deps.landingZone.append('orcid', rawRecords)
        } catch (error) {
          report.warnings.push(
            `Raw landing write failed: ${error instanceof Error ? error.message : String(error)}`,
          )
        }
      }

      report.peopleDiscovered = dossiers.length
      report.artifactsObserved = dossiers.reduce((sum, dossier) => sum + dossier.artifacts.length, 0)
      report.identityAnchorsProduced = dossiers.reduce((sum, dossier) => sum + dossier.anchors.length, 0)
      report.deterministicAnchorsProduced = dossiers.reduce(
        (sum, dossier) => sum + dossier.anchors.filter(anchor => anchor.strength === 'deterministic').length,
        0,
      )
      report.durationMs = Date.now() - startedAt

      return {
        source: 'orcid',
        runId,
        dossiers,
        rawRecords,
        report,
        landingPath,
        creditsSpent: haltReason === null ? actualCredits : 0,
        haltReason,
      }
    },
  }
}
