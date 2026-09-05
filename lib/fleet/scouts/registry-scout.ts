/**
 * Package Registry Scout (Fleet 1).
 *
 * Sources: crates.io and the npm registry, both official documented APIs.
 *
 * The evidence model here is narrow on purpose. Publishing or owning a package
 * is strong evidence that a person works in that ecosystem, so ownership
 * becomes an `owner_maintainer` artifact with the package's own language or
 * keywords as observed technologies.
 *
 * Download count is recorded as a source metric and nothing more. The original
 * fleet spec proposed "owner of a crate with more than 500k downloads is a
 * Staff Engineer". That inference is not supported: download count measures
 * how popular an artifact is, not what title its author holds. Writing it as a
 * seniority claim would be the same defect class as writing a search term onto
 * a candidate, one inference hop further out. The count is shown, the
 * conclusion is left to the recruiter.
 *
 * PyPI is intentionally absent. Its search API was retired and the JSON API
 * only answers for a package you can already name, which makes it an
 * enrichment source rather than a discovery source.
 */

import {
  newRunReport,
  observedTechnology,
  type DiscoveryIntent,
  type IdentityAnchor,
  type ObservationProvenance,
  type SourceMetric,
  type TechnicalArtifact,
  type TechnicalDossier,
  type ObservedTechnology,
} from '../../connectors/contract-v33-3'
import { ConnectorRequestLedger } from '../../connectors/request-ledger-v33-3'
import { retrievalTermText } from '../../connectors/contract-v33-3'
import type { SourceName } from '../../source-types'
import { OPERATION_CREDIT_COST } from '../credit-ledger'
import { dossierToRawRecord } from './github-scout'
import type { ScoutAgent, ScoutDeps, ScoutResult } from '../types'

const CRATES_API = 'https://crates.io/api/v1'
const NPM_API = 'https://registry.npmjs.org'

/* ------------------------------------------------------------------ *
 * Payload shapes
 * ------------------------------------------------------------------ */

export type CratePayload = {
  id?: string
  name?: string
  description?: string | null
  downloads?: number
  recent_downloads?: number | null
  repository?: string | null
  homepage?: string | null
  keywords?: string[] | null
  created_at?: string
  updated_at?: string
}

export type CrateOwnerPayload = {
  id?: number
  login?: string
  name?: string | null
  url?: string | null
  kind?: string
}

export type NpmMaintainer = { username?: string; email?: string }

export type NpmSearchObject = {
  package?: {
    name?: string
    description?: string
    keywords?: string[]
    date?: string
    links?: { npm?: string; homepage?: string; repository?: string }
    publisher?: NpmMaintainer
    maintainers?: NpmMaintainer[]
  }
  score?: { detail?: { popularity?: number; quality?: number; maintenance?: number } }
}

/* ------------------------------------------------------------------ *
 * Dossier construction
 * ------------------------------------------------------------------ */

function provenance(
  source: SourceName,
  sourceField: string,
  sourceRecordId: string,
  observedAt: string,
  url?: string,
): ObservationProvenance {
  return {
    source,
    sourceField,
    sourceRecordId,
    basis: 'observed_artifact',
    url,
    observedAt,
  }
}

/**
 * A crates.io owner record with `kind: 'team'` is a GitHub team, not a human.
 * Personhood is decided by the field the API published, never by whether the
 * name looks like a person's name.
 */
export function isHumanCrateOwner(owner: CrateOwnerPayload): boolean {
  if (!owner.login) return false
  return owner.kind !== 'team'
}

export function buildCrateOwnerDossier(input: {
  owner: CrateOwnerPayload
  crates: readonly CratePayload[]
  observedAt: string
}): TechnicalDossier | null {
  const login = String(input.owner.login || '').trim()
  if (!login) return null

  const profileUrl = `https://crates.io/users/${encodeURIComponent(login)}`
  const artifacts: TechnicalArtifact[] = []
  const technologies: ObservedTechnology[] = []

  for (const crate of input.crates) {
    const name = String(crate.name || crate.id || '').trim()
    if (!name) continue

    const metrics: SourceMetric[] = []
    if (typeof crate.downloads === 'number') {
      metrics.push({
        key: 'crate_downloads_total',
        label: 'All-time downloads',
        value: crate.downloads,
        source: 'crates',
      })
    }
    if (typeof crate.recent_downloads === 'number') {
      metrics.push({
        key: 'crate_downloads_recent',
        label: 'Recent downloads (90 days)',
        value: crate.recent_downloads,
        source: 'crates',
      })
    }

    const crateProvenance = provenance(
      'crates',
      'crate.keywords',
      name,
      input.observedAt,
      `https://crates.io/crates/${encodeURIComponent(name)}`,
    )

    // Rust is observed directly: every crate on crates.io is a Rust package,
    // which is a property of the registry, not an inference about the person.
    const rust = observedTechnology(
      'Rust',
      provenance(
        'crates',
        'registry.language',
        name,
        input.observedAt,
        `https://crates.io/crates/${encodeURIComponent(name)}`,
      ),
    )
    const crateTechnologies: ObservedTechnology[] = rust ? [rust] : []

    for (const keyword of crate.keywords || []) {
      const tech = observedTechnology(keyword, crateProvenance)
      if (tech) crateTechnologies.push(tech)
    }

    technologies.push(...crateTechnologies)

    artifacts.push({
      artifactId: `crates:${name}`,
      source: 'crates',
      type: 'package',
      name,
      url: `https://crates.io/crates/${encodeURIComponent(name)}`,
      description: crate.description || undefined,
      statement: `listed as an owner of the crate ${name} on crates.io`,
      relationship: 'owner_maintainer',
      technologies: crateTechnologies,
      metrics,
      createdAt: crate.created_at,
      updatedAt: crate.updated_at,
      observedAt: input.observedAt,
    })
  }

  if (!artifacts.length) return null

  const anchors: IdentityAnchor[] = [
    {
      kind: 'source_profile_url',
      value: profileUrl,
      normalized: `crates:${login.toLowerCase()}`,
      strength: 'supporting',
      provenance: provenance('crates', 'owner.login', login, input.observedAt, profileUrl),
    },
  ]

  // crates.io owner URLs point at the GitHub account that owns the crate. That
  // is a person-specific pointer published by the registry, so it is a
  // deterministic anchor rather than a resemblance.
  const ownerUrl = String(input.owner.url || '')
  const githubMatch = ownerUrl.match(/^https?:\/\/github\.com\/([A-Za-z0-9-]+)\/?$/i)
  if (githubMatch) {
    anchors.push({
      kind: 'github_login',
      value: githubMatch[1],
      normalized: githubMatch[1].toLowerCase(),
      strength: 'deterministic',
      provenance: provenance('crates', 'owner.url', login, input.observedAt, ownerUrl),
    })
  }

  return {
    source: 'crates',
    person: {
      source: 'crates',
      sourceProfileId: login,
      profileUrl,
      displayName: input.owner.name || login,
      websites: ownerUrl ? [ownerUrl] : [],
    },
    artifacts,
    technologies,
    anchors,
    activity: {
      activeYears: Array.from(
        new Set(
          artifacts
            .map(artifact => Number(String(artifact.updatedAt || '').slice(0, 4)))
            .filter(year => Number.isFinite(year) && year > 1990),
        ),
      ),
    },
    limits: [
      {
        topic: 'Seniority',
        explanation:
          'crates.io publishes ownership and download counts. It states nothing about job title, seniority, or employer, and download volume is not a proxy for any of them.',
      },
      {
        topic: 'Location and employer',
        explanation: 'crates.io does not publish a location or employer field for owners.',
      },
    ],
    observedAt: input.observedAt,
    raw: { owner: input.owner, crateCount: artifacts.length },
  }
}

export function buildNpmMaintainerDossier(input: {
  maintainer: NpmMaintainer
  packages: readonly NpmSearchObject[]
  observedAt: string
}): TechnicalDossier | null {
  const username = String(input.maintainer.username || '').trim()
  if (!username) return null

  const profileUrl = `https://www.npmjs.com/~${encodeURIComponent(username)}`
  const artifacts: TechnicalArtifact[] = []
  const technologies: ObservedTechnology[] = []

  for (const object of input.packages) {
    const pkg = object.package
    const name = String(pkg?.name || '').trim()
    if (!name) continue

    const packageUrl = pkg?.links?.npm || `https://www.npmjs.com/package/${name}`
    const packageProvenance = provenance('npm', 'package.keywords', name, input.observedAt, packageUrl)

    const packageTechnologies: ObservedTechnology[] = []
    for (const keyword of pkg?.keywords || []) {
      const tech = observedTechnology(keyword, packageProvenance)
      if (tech) packageTechnologies.push(tech)
    }
    technologies.push(...packageTechnologies)

    artifacts.push({
      artifactId: `npm:${name}`,
      source: 'npm',
      type: 'package',
      name,
      url: packageUrl,
      description: pkg?.description,
      statement: `listed as a maintainer of the npm package ${name}`,
      relationship: 'owner_maintainer',
      technologies: packageTechnologies,
      metrics: [],
      updatedAt: pkg?.date,
      observedAt: input.observedAt,
    })
  }

  if (!artifacts.length) return null

  const anchors: IdentityAnchor[] = [
    {
      kind: 'source_profile_url',
      value: profileUrl,
      normalized: `npm:${username.toLowerCase()}`,
      strength: 'supporting',
      provenance: provenance('npm', 'maintainer.username', username, input.observedAt, profileUrl),
    },
  ]

  // The registry publishes maintainer email. It is a public field on a public
  // package, so it is usable as an identity anchor. It is not contact data and
  // must not be surfaced for outreach.
  const email = String(input.maintainer.email || '').trim().toLowerCase()
  if (email && email.includes('@')) {
    anchors.push({
      kind: 'public_email',
      value: email,
      normalized: email,
      strength: 'deterministic',
      provenance: provenance('npm', 'maintainer.email', username, input.observedAt, profileUrl),
    })
  }

  return {
    source: 'npm',
    person: {
      source: 'npm',
      sourceProfileId: username,
      profileUrl,
      displayName: username,
      websites: [],
    },
    artifacts,
    technologies,
    anchors,
    activity: {
      activeYears: Array.from(
        new Set(
          artifacts
            .map(artifact => Number(String(artifact.updatedAt || '').slice(0, 4)))
            .filter(year => Number.isFinite(year) && year > 1990),
        ),
      ),
    },
    limits: [
      {
        topic: 'Identity',
        explanation:
          'An npm maintainer username is an account, not a verified person. A shared release account can carry many maintainers.',
      },
      {
        topic: 'Seniority and employer',
        explanation: 'The npm registry publishes no title, seniority, or employer field.',
      },
    ],
    observedAt: input.observedAt,
    raw: { maintainer: { username }, packageCount: artifacts.length },
  }
}

/* ------------------------------------------------------------------ *
 * Scout
 * ------------------------------------------------------------------ */

export function buildRegistryQuery(intent: DiscoveryIntent): string {
  const terms = intent.capabilityTerms.map(retrievalTermText).filter(Boolean)
  if (terms.length) return terms.slice(0, 3).join(' ')
  return retrievalTermText(intent.hypothesis).split(/\s+/).slice(0, 3).join(' ')
}

export type RegistryScoutOptions = {
  registry: 'crates' | 'npm'
  maxPackages?: number
  maxPeople?: number
  fetchImpl?: typeof fetch
}

export function createRegistryScout(options: RegistryScoutOptions): ScoutAgent {
  const source: SourceName = options.registry === 'crates' ? 'crates' : 'npm'

  return {
    key: `scout.${source}`,
    source,
    label: options.registry === 'crates' ? 'crates.io' : 'npm',

    async run(intent: DiscoveryIntent, deps: ScoutDeps): Promise<ScoutResult> {
      const startedAt = Date.now()
      const runId = intent.runId || `run_${startedAt.toString(36)}`
      const report = newRunReport(source)
      const observedAt = deps.now?.() || new Date().toISOString()

      const estimated = OPERATION_CREDIT_COST.source_discovery * Math.max(1, intent.limit)
      const reservation = await deps.credits.reserve({
        runId,
        operation: 'source_discovery',
        source,
        estimatedCredits: estimated,
      })

      if (!reservation.granted) {
        report.partial = true
        report.warnings.push(`Halted before calling ${source}: budget could not cover ${estimated} credits.`)
        return {
          source,
          runId,
          dossiers: [],
          rawRecords: [],
          report,
          landingPath: null,
          creditsSpent: 0,
          haltReason: 'budget_exhausted',
        }
      }

      const ledger = new ConnectorRequestLedger({ sourceKey: source, report, fetchImpl: options.fetchImpl })
      const query = buildRegistryQuery(intent)
      const maxPackages = Math.max(1, Math.min(options.maxPackages ?? 10, 25))
      const maxPeople = Math.max(1, Math.min(options.maxPeople ?? intent.limit, 25))

      let dossiers: TechnicalDossier[] = []
      let haltReason: ScoutResult['haltReason'] = null

      try {
        dossiers =
          options.registry === 'crates'
            ? await discoverCrateOwners({ ledger, query, maxPackages, maxPeople, observedAt })
            : await discoverNpmMaintainers({ ledger, query, maxPackages, maxPeople, observedAt })
      } catch (error) {
        report.apiErrors += 1
        report.partial = true
        report.warnings.push(
          `${source} discovery failed: ${error instanceof Error ? error.message : String(error)}`,
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
          landingPath = await deps.landingZone.append(source, rawRecords)
        } catch (error) {
          report.warnings.push(
            `Raw landing write failed: ${error instanceof Error ? error.message : String(error)}`,
          )
        }
      }

      report.peopleDiscovered = dossiers.length
      report.artifactsObserved = dossiers.reduce((sum, d) => sum + d.artifacts.length, 0)
      report.durationMs = Date.now() - startedAt

      return {
        source,
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

async function discoverCrateOwners(input: {
  ledger: ConnectorRequestLedger
  query: string
  maxPackages: number
  maxPeople: number
  observedAt: string
}): Promise<TechnicalDossier[]> {
  const search = await input.ledger.json<{ crates?: CratePayload[] }>(
    `crates:search:${input.query}:${input.maxPackages}`,
    `${CRATES_API}/crates?q=${encodeURIComponent(input.query)}&per_page=${input.maxPackages}&sort=downloads`,
  )

  const crates = search?.crates || []
  const byOwner = new Map<string, { owner: CrateOwnerPayload; crates: CratePayload[] }>()

  for (const crate of crates) {
    const name = String(crate.name || crate.id || '').trim()
    if (!name) continue
    if (byOwner.size >= input.maxPeople) break

    const owners = await input.ledger.json<{ users?: CrateOwnerPayload[] }>(
      `crates:owners:${name}`,
      `${CRATES_API}/crates/${encodeURIComponent(name)}/owners`,
    )

    for (const owner of owners?.users || []) {
      if (!isHumanCrateOwner(owner)) continue
      const key = String(owner.login).toLowerCase()
      const existing = byOwner.get(key)
      if (existing) {
        existing.crates.push(crate)
      } else {
        if (byOwner.size >= input.maxPeople) break
        byOwner.set(key, { owner, crates: [crate] })
      }
    }
  }

  const out: TechnicalDossier[] = []
  for (const entry of byOwner.values()) {
    const dossier = buildCrateOwnerDossier({
      owner: entry.owner,
      crates: entry.crates,
      observedAt: input.observedAt,
    })
    if (dossier) out.push(dossier)
  }
  return out
}

async function discoverNpmMaintainers(input: {
  ledger: ConnectorRequestLedger
  query: string
  maxPackages: number
  maxPeople: number
  observedAt: string
}): Promise<TechnicalDossier[]> {
  const search = await input.ledger.json<{ objects?: NpmSearchObject[] }>(
    `npm:search:${input.query}:${input.maxPackages}`,
    `${NPM_API}/-/v1/search?text=${encodeURIComponent(input.query)}&size=${input.maxPackages}`,
  )

  const byMaintainer = new Map<string, { maintainer: NpmMaintainer; packages: NpmSearchObject[] }>()

  for (const object of search?.objects || []) {
    const maintainers = object.package?.maintainers || []
    for (const maintainer of maintainers) {
      const username = String(maintainer.username || '').trim().toLowerCase()
      if (!username) continue
      const existing = byMaintainer.get(username)
      if (existing) {
        existing.packages.push(object)
      } else {
        if (byMaintainer.size >= input.maxPeople) continue
        byMaintainer.set(username, { maintainer, packages: [object] })
      }
    }
  }

  const out: TechnicalDossier[] = []
  for (const entry of byMaintainer.values()) {
    const dossier = buildNpmMaintainerDossier({
      maintainer: entry.maintainer,
      packages: entry.packages,
      observedAt: input.observedAt,
    })
    if (dossier) out.push(dossier)
  }
  return out
}
