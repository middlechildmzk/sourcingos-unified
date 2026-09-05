/**
 * NPPES Scout (Fleet 1) - US healthcare provider registry.
 *
 * Source: the CMS National Plan and Provider Enumeration System, API v2.1.
 * Free, keyless, official, and complete: every clinician who bills a US payer
 * has an NPI, which makes this the only profession with a public, government
 * maintained, nationally complete directory. There is no equivalent for
 * software engineers, program managers, or anyone else.
 *
 * There is a market of paid scrapers reselling this exact data as "healthcare
 * leads". This connector calls the federal API directly instead. The data is
 * identical, the source is authoritative, and the provenance is honest.
 *
 * Five rules this connector enforces that a lead scraper does not:
 *
 *   1. Personhood comes from `enumeration_type`, never from name shape.
 *      NPI-1 is an individual, NPI-2 is an organization. A sole-proprietor
 *      dental practice named "Dr. Sarah Chen DDS PC" is an NPI-2 and is not a
 *      person, regardless of how the name reads.
 *
 *   2. Deactivated records are never presented as current. `basic.status` of
 *      'A' means active; anything else is excluded with a stated reason.
 *
 *   3. A practice address is a workplace, not a home address, and is labelled
 *      as such. Recording a clinic street address as a candidate's location
 *      would be both wrong and invasive.
 *
 *   4. Taxonomy is self-attested. The provider selects their own NUCC taxonomy
 *      code, so specialty is `source_stated`, not `observed_artifact`.
 *
 *   5. Practice phone and fax are deliberately not carried onto the person.
 *      They are public, and they are still contact data, which belongs in the
 *      contact-governance lane rather than arriving silently through discovery.
 *
 * What this connector does NOT infer: seniority, employer as an employment
 * relationship, willingness to move, or clinical quality. A license number is
 * an identity anchor, not a competence signal.
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

const NPPES_API = 'https://npiregistry.cms.hhs.gov/api'
const NPPES_VERSION = '2.1'

/* ------------------------------------------------------------------ *
 * Payload shapes (NPPES API v2.1)
 * ------------------------------------------------------------------ */

export type NppesBasic = {
  first_name?: string
  last_name?: string
  middle_name?: string
  name_prefix?: string
  name_suffix?: string
  credential?: string
  sole_proprietor?: string
  gender?: string
  enumeration_date?: string
  last_updated?: string
  status?: string
  deactivation_date?: string
  organization_name?: string
}

export type NppesAddress = {
  country_code?: string
  country_name?: string
  address_purpose?: string
  address_type?: string
  address_1?: string
  address_2?: string
  city?: string
  state?: string
  postal_code?: string
  telephone_number?: string
  fax_number?: string
}

export type NppesTaxonomy = {
  code?: string
  taxonomy_group?: string
  desc?: string
  state?: string
  license?: string
  primary?: boolean
}

export type NppesIdentifier = {
  code?: string
  desc?: string
  issuer?: string
  identifier?: string
  state?: string
}

export type NppesResult = {
  number?: number | string
  enumeration_type?: string
  created_epoch?: number | string
  last_updated_epoch?: number | string
  basic?: NppesBasic
  addresses?: NppesAddress[]
  practiceLocations?: NppesAddress[]
  taxonomies?: NppesTaxonomy[]
  identifiers?: NppesIdentifier[]
}

export type NppesResponse = {
  result_count?: number
  results?: NppesResult[]
  Errors?: Array<{ description?: string; field?: string }>
}

/* ------------------------------------------------------------------ *
 * Classification
 * ------------------------------------------------------------------ */

/**
 * Only NPI-1 is a human being. This is the field the registry publishes for
 * exactly this purpose, so there is never a reason to guess from the name.
 */
export function isIndividualProvider(result: NppesResult): boolean {
  return String(result.enumeration_type || '').toUpperCase() === 'NPI-1'
}

/** 'A' is the only active status NPPES publishes. */
export function isActiveRecord(result: NppesResult): boolean {
  const status = String(result.basic?.status || '').toUpperCase()
  if (!status) return true // Older records omit status entirely.
  return status === 'A'
}

export function providerDisplayName(basic: NppesBasic | undefined): string {
  if (!basic) return ''
  const parts = [basic.first_name, basic.middle_name, basic.last_name]
    .map(part => String(part || '').trim())
    .filter(Boolean)
  const name = parts.join(' ')
  const credential = String(basic.credential || '').trim()
  return credential ? `${name}, ${credential}` : name
}

export function primaryPracticeAddress(result: NppesResult): NppesAddress | undefined {
  const pool = [...(result.addresses || []), ...(result.practiceLocations || [])]
  return (
    pool.find(address => String(address.address_purpose || '').toUpperCase() === 'LOCATION') ||
    pool[0]
  )
}

/**
 * A practice city and state, formatted for display.
 *
 * Street address is deliberately dropped. City and state are what a recruiter
 * needs to assess geography; the street line adds nothing to that judgement and
 * is closer to surveillance than sourcing.
 */
export function practiceRegion(address: NppesAddress | undefined): string | undefined {
  if (!address) return undefined
  const city = String(address.city || '').trim()
  const state = String(address.state || '').trim()
  if (!city && !state) return undefined
  return [city, state].filter(Boolean).join(', ')
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
  return { source: 'npi', sourceField, sourceRecordId, basis, url, observedAt }
}

export function buildNppesDossier(input: {
  result: NppesResult
  observedAt: string
}): TechnicalDossier | null {
  const { result, observedAt } = input

  if (!isIndividualProvider(result)) return null
  if (!isActiveRecord(result)) return null

  const npi = String(result.number || '').trim()
  if (!/^\d{10}$/.test(npi)) return null

  const basic = result.basic || {}
  const displayName = providerDisplayName(basic)
  if (!displayName) return null

  const profileUrl = `https://npiregistry.cms.hhs.gov/provider-view/${npi}`
  const artifacts: TechnicalArtifact[] = []
  const technologies: ObservedTechnology[] = []
  const anchors: IdentityAnchor[] = []

  /* -------- Taxonomies: specialty and licensure -------- */

  for (const taxonomy of result.taxonomies || []) {
    const description = String(taxonomy.desc || '').trim()
    const code = String(taxonomy.code || '').trim()
    if (!description && !code) continue

    // Self-attested: the provider picks their own NUCC taxonomy code.
    const taxonomyProvenance = provenance(
      'taxonomies.desc',
      `${npi}:${code || description}`,
      observedAt,
      'source_stated',
      profileUrl,
    )

    if (description) {
      const specialty = observedTechnology(description, taxonomyProvenance)
      if (specialty) technologies.push(specialty)
    }

    const licenseState = String(taxonomy.state || '').trim()
    const licenseNumber = String(taxonomy.license || '').trim()

    artifacts.push({
      artifactId: `npi:${npi}:${code || description}`,
      source: 'npi',
      type: 'professional_license',
      name: description || code,
      url: profileUrl,
      description: code ? `NUCC taxonomy code ${code}` : undefined,
      statement: licenseState
        ? `registered with NPPES under the taxonomy ${description || code}, licensed in ${licenseState}`
        : `registered with NPPES under the taxonomy ${description || code}`,
      // NPPES publishes the registration. It does not describe scope of work,
      // so no relationship stronger than authorship is claimable.
      relationship: 'author',
      technologies: [],
      metrics: [],
      updatedAt: basic.last_updated,
      observedAt,
    })

    // A state license number is government-issued and unique within its state,
    // which makes it a usable identity anchor across licensure sources.
    if (licenseNumber && licenseState) {
      anchors.push({
        kind: 'explicit_profile_link',
        value: `${licenseState}:${licenseNumber}`,
        normalized: `license:${licenseState.toLowerCase()}:${licenseNumber.toLowerCase()}`,
        strength: 'supporting',
        provenance: provenance(
          'taxonomies.license',
          `${npi}:${code || description}`,
          observedAt,
          'source_stated',
          profileUrl,
        ),
      })
    }
  }

  if (!artifacts.length) return null

  /* -------- Identity anchors -------- */

  anchors.unshift({
    kind: 'npi_number',
    value: npi,
    normalized: `npi:${npi}`,
    strength: 'deterministic',
    provenance: provenance('number', npi, observedAt, 'observed_artifact', profileUrl),
  })

  anchors.push({
    kind: 'source_profile_url',
    value: profileUrl,
    normalized: `npi_profile:${npi}`,
    strength: 'supporting',
    provenance: provenance('number', npi, observedAt, 'observed_artifact', profileUrl),
  })

  /* -------- Limits: what NPPES cannot establish -------- */

  const address = primaryPracticeAddress(result)
  const limits: DossierLimit[] = [
    {
      topic: 'Location',
      explanation:
        'NPPES publishes a practice location, which is a workplace address and not a home address. Street detail is intentionally not carried onto the record.',
    },
    {
      topic: 'Employer',
      explanation:
        'A practice location is where services are billed from. It does not establish who employs this clinician, and many clinicians bill from several locations.',
    },
    {
      topic: 'Seniority',
      explanation:
        'NPPES publishes no title, rank, or years of experience. Enumeration date records when the NPI was issued, which is not the same as when the person began practising.',
    },
    {
      topic: 'Contact',
      explanation:
        'The registry publishes a practice telephone and fax. Those are deliberately not carried onto this record and must be requested through the contact governance lane.',
    },
    {
      topic: 'Licensure standing',
      explanation:
        'A license number recorded in NPPES is self-reported at enumeration. It is not a live verification of current licensure standing with the issuing state board.',
    },
  ]

  if (!result.taxonomies?.some(taxonomy => taxonomy.primary)) {
    limits.push({
      topic: 'Primary specialty',
      explanation: 'No taxonomy on this record is flagged primary, so a single main specialty cannot be stated.',
    })
  }

  const enumerationYear = Number(String(basic.enumeration_date || '').slice(0, 4))
  const updatedYear = Number(String(basic.last_updated || '').slice(0, 4))

  return {
    source: 'npi',
    person: {
      source: 'npi',
      sourceProfileId: npi,
      profileUrl,
      displayName,
      headline: result.taxonomies?.find(taxonomy => taxonomy.primary)?.desc,
      // No employer is claimed. NPPES does not publish one.
      statedLocation: practiceRegion(address),
      websites: [],
    },
    artifacts,
    technologies,
    anchors,
    activity: {
      firstObservedAt: basic.enumeration_date,
      lastObservedAt: basic.last_updated,
      activeYears: Array.from(
        new Set([enumerationYear, updatedYear].filter(year => Number.isFinite(year) && year > 1990)),
      ),
    },
    limits,
    observedAt,
    raw: {
      number: npi,
      enumeration_type: result.enumeration_type,
      taxonomyCount: result.taxonomies?.length || 0,
      // Phone and fax are dropped at the boundary rather than stored and
      // filtered later, so they cannot leak through a downstream consumer.
      contactWithheld: true,
    },
  }
}

/* ------------------------------------------------------------------ *
 * Query planning
 * ------------------------------------------------------------------ */

const US_STATE_CODES = new Set([
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD',
  'MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC',
  'SD','TN','TX','UT','VT','VA','WA','WV','WI','WY','DC','PR','VI','GU','AS','MP',
])

export type NppesQueryPlan = {
  readonly taxonomyDescription: string | null
  readonly state: string | null
  readonly city: string | null
}

/**
 * Turn a retrieval intent into NPPES parameters.
 *
 * NPPES requires at least one criterion beyond `limit`, so a plan with nothing
 * usable is reported as a source limit rather than sent as a bare query that
 * would return an error.
 */
export function planNppesQuery(intent: DiscoveryIntent): NppesQueryPlan {
  const terms = intent.capabilityTerms.map(retrievalTermText).map(term => term.trim()).filter(Boolean)
  const locationText = intent.location ? retrievalTermText(intent.location).trim() : ''

  let state: string | null = null
  let city: string | null = null

  if (locationText) {
    // Accept "Minneapolis, MN", "MN", or a bare city.
    const parts = locationText.split(',').map(part => part.trim()).filter(Boolean)
    for (const part of parts) {
      const upper = part.toUpperCase()
      if (US_STATE_CODES.has(upper)) {
        state = upper
      } else if (!city) {
        city = part
      }
    }
  }

  // NPPES matches taxonomy_description against NUCC descriptions, so the first
  // capability term is used verbatim rather than being decomposed.
  const taxonomyDescription = terms[0] || null

  return { taxonomyDescription, state, city }
}

export function buildNppesUrl(plan: NppesQueryPlan, limit: number): string | null {
  const params = new URLSearchParams({
    version: NPPES_VERSION,
    enumeration_type: 'NPI-1',
    limit: String(Math.max(1, Math.min(limit, 200))),
  })

  let hasCriterion = false
  if (plan.taxonomyDescription) {
    params.set('taxonomy_description', plan.taxonomyDescription)
    hasCriterion = true
  }
  if (plan.state) {
    params.set('state', plan.state)
    hasCriterion = true
  }
  if (plan.city) {
    params.set('city', plan.city)
    hasCriterion = true
  }

  if (!hasCriterion) return null
  return `${NPPES_API}/?${params.toString()}`
}

/* ------------------------------------------------------------------ *
 * Scout
 * ------------------------------------------------------------------ */

export type NppesScoutOptions = {
  maxPeople?: number
  fetchImpl?: typeof fetch
}

export function createNppesScout(options: NppesScoutOptions = {}): ScoutAgent {
  return {
    key: 'scout.npi',
    source: 'npi',
    label: 'NPPES NPI Registry',

    async run(intent: DiscoveryIntent, deps: ScoutDeps): Promise<ScoutResult> {
      const startedAt = Date.now()
      const runId = intent.runId || `run_${startedAt.toString(36)}`
      const report = newRunReport('npi')
      const observedAt = deps.now?.() || new Date().toISOString()

      const plan = planNppesQuery(intent)
      const limit = Math.max(1, Math.min(options.maxPeople ?? intent.limit, 50))
      const url = buildNppesUrl(plan, limit)

      if (!url) {
        report.partial = true
        report.warnings.push(
          'NPPES needs a specialty or a location to search. This intent supplied neither, so nobody was looked for. That is a query limitation, not an absence of clinicians.',
        )
        report.durationMs = Date.now() - startedAt
        return {
          source: 'npi',
          runId,
          dossiers: [],
          rawRecords: [],
          report,
          landingPath: null,
          creditsSpent: 0,
          haltReason: null,
        }
      }

      const estimated = OPERATION_CREDIT_COST.source_discovery * limit
      const reservation = await deps.credits.reserve({
        runId,
        operation: 'source_discovery',
        source: 'npi',
        estimatedCredits: estimated,
      })

      if (!reservation.granted) {
        report.partial = true
        report.warnings.push(`Halted before calling NPPES: budget could not cover ${estimated} credits.`)
        return {
          source: 'npi',
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
        sourceKey: 'npi',
        report,
        fetchImpl: options.fetchImpl,
      })

      let dossiers: TechnicalDossier[] = []
      let haltReason: ScoutResult['haltReason'] = null
      let organizationsSkipped = 0
      let inactiveSkipped = 0

      try {
        const payload = await ledger.json<NppesResponse>(
          `npi:search:${plan.taxonomyDescription || ''}:${plan.state || ''}:${plan.city || ''}:${limit}`,
          url,
        )

        if (payload?.Errors?.length) {
          const detail = payload.Errors.map(error => error.description).filter(Boolean).join('; ')
          report.warnings.push(`NPPES rejected the query: ${detail || 'unspecified error'}`)
          report.partial = true
        }

        for (const result of payload?.results || []) {
          if (!isIndividualProvider(result)) {
            organizationsSkipped += 1
            continue
          }
          if (!isActiveRecord(result)) {
            inactiveSkipped += 1
            continue
          }
          const dossier = buildNppesDossier({ result, observedAt })
          if (dossier) dossiers.push(dossier)
        }

        if (organizationsSkipped) {
          report.warnings.push(
            `${organizationsSkipped} NPI-2 organization records were excluded. An organization is not a person even when its registered name reads like one.`,
          )
        }
        if (inactiveSkipped) {
          report.warnings.push(
            `${inactiveSkipped} deactivated NPI records were excluded rather than presented as current.`,
          )
        }
      } catch (error) {
        report.apiErrors += 1
        report.partial = true
        report.warnings.push(
          `NPPES discovery failed: ${error instanceof Error ? error.message : String(error)}`,
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
          landingPath = await deps.landingZone.append('npi', rawRecords)
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
        source: 'npi',
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
