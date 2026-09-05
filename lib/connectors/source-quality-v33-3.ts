/**
 * Source-quality measurement for technical connectors.
 *
 * Every metric here is computed from what the run actually did. Recruiter
 * ground truth is never fabricated: `recruiterAccepted` and
 * `recruiterReviewed` stay null until real labels exist, and acceptance rate
 * is undefined rather than zero when nothing has been reviewed. Treating
 * unreviewed candidates as rejections would quietly punish every new source.
 */

import type { SourceName } from '../source-types'
import type {
  ConnectorMetadata,
  ConnectorRunReport,
  TechnicalDossier,
} from './contract-v33-3'
import { githubConnectorMetadata } from './github-v2'
import { stackOverflowConnectorMetadata } from './stackoverflow-v2'

export const technicalConnectorRegistry: Record<string, ConnectorMetadata> = {
  github: githubConnectorMetadata,
  stackoverflow: stackOverflowConnectorMetadata,
}

export type SourceQualityMetrics = {
  readonly sourceKey: SourceName
  readonly peopleDiscovered: number
  /** Distinct source profile ids returned. Duplicates within a run are waste. */
  readonly distinctProfiles: number
  readonly duplicateRate: number
  /** Share of discovered people carrying at least one observed technology. */
  readonly evidenceCoverage: number
  /** Share of discovered people carrying at least one deterministic anchor. */
  readonly identityAnchorYield: number
  /** Observed technologies with no artifact behind them. Should always be 0. */
  readonly unsupportedClaimCount: number
  readonly artifactsPerPerson: number
  readonly apiCallsPerUsefulCandidate: number | null
  readonly cacheHitRate: number
  readonly errorCount: number
  readonly backoffSeconds: number
  readonly quotaRemaining: number | null
  readonly partial: boolean
  readonly durationMs: number
  /** Null until recruiter labels exist. Never inferred. */
  readonly recruiterReviewed: number | null
  readonly recruiterAccepted: number | null
  readonly recruiterAcceptanceRate: number | null
}

export type RecruiterLabelSummary = {
  reviewed: number
  accepted: number
}

function ratio(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0
  return Math.round((numerator / denominator) * 1000) / 1000
}

export function summarizeSourceQuality(input: {
  report: ConnectorRunReport
  dossiers: readonly TechnicalDossier[]
  labels?: RecruiterLabelSummary | null
}): SourceQualityMetrics {
  const { report, dossiers } = input
  const ids = dossiers.map(dossier => `${dossier.source}:${dossier.person.sourceProfileId}`)
  const distinctProfiles = new Set(ids).size

  const withEvidence = dossiers.filter(dossier => dossier.technologies.length > 0).length
  const withDeterministicAnchor = dossiers.filter(dossier =>
    dossier.anchors.some(anchor => anchor.strength === 'deterministic' && anchor.kind !== 'source_profile_url'),
  ).length

  const artifactIds = new Set(dossiers.flatMap(dossier => dossier.artifacts.map(artifact => artifact.artifactId)))
  const personIds = new Set(dossiers.map(dossier => dossier.person.sourceProfileId))
  const unsupportedClaimCount = dossiers.reduce(
    (sum, dossier) =>
      sum +
      dossier.technologies.filter(
        technology =>
          !artifactIds.has(technology.provenance.sourceRecordId) &&
          !personIds.has(technology.provenance.sourceRecordId),
      ).length,
    0,
  )

  const artifactCount = dossiers.reduce((sum, dossier) => sum + dossier.artifacts.length, 0)
  const totalRequests = report.requestsAttempted + report.requestsServedFromCache

  const labels = input.labels || null

  return {
    sourceKey: report.sourceKey,
    peopleDiscovered: dossiers.length,
    distinctProfiles,
    duplicateRate: ratio(dossiers.length - distinctProfiles, dossiers.length),
    evidenceCoverage: ratio(withEvidence, dossiers.length),
    identityAnchorYield: ratio(withDeterministicAnchor, dossiers.length),
    unsupportedClaimCount,
    artifactsPerPerson: dossiers.length ? Math.round((artifactCount / dossiers.length) * 100) / 100 : 0,
    apiCallsPerUsefulCandidate: withEvidence > 0 ? Math.round((report.requestsAttempted / withEvidence) * 100) / 100 : null,
    cacheHitRate: ratio(report.requestsServedFromCache, totalRequests),
    errorCount: report.apiErrors,
    backoffSeconds: report.backoffSeconds,
    quotaRemaining: report.quotaRemaining,
    partial: report.partial,
    durationMs: report.durationMs,
    recruiterReviewed: labels ? labels.reviewed : null,
    recruiterAccepted: labels ? labels.accepted : null,
    recruiterAcceptanceRate:
      labels && labels.reviewed > 0 ? Math.round((labels.accepted / labels.reviewed) * 1000) / 1000 : null,
  }
}

/**
 * Unique contribution: how many canonical people a source brought that no
 * other source in the same run produced. Sources are compared on deterministic
 * anchors only, never on name similarity, so this metric cannot manufacture a
 * merge that the Identity Brain would refuse.
 */
export function uniqueContributionBySource(
  dossiers: readonly TechnicalDossier[],
): Record<string, { discovered: number; uniqueByAnchor: number }> {
  const anchorOwners = new Map<string, Set<SourceName>>()
  for (const dossier of dossiers) {
    for (const anchor of dossier.anchors) {
      if (anchor.strength !== 'deterministic') continue
      if (anchor.kind === 'source_profile_url') continue
      const key = `${anchor.kind}|${anchor.normalized}`
      const owners = anchorOwners.get(key) || new Set<SourceName>()
      owners.add(dossier.source)
      anchorOwners.set(key, owners)
    }
  }

  const out: Record<string, { discovered: number; uniqueByAnchor: number }> = {}
  for (const dossier of dossiers) {
    const entry = out[dossier.source] || { discovered: 0, uniqueByAnchor: 0 }
    entry.discovered += 1
    const sharedWithOtherSource = dossier.anchors.some(anchor => {
      if (anchor.strength !== 'deterministic' || anchor.kind === 'source_profile_url') return false
      const owners = anchorOwners.get(`${anchor.kind}|${anchor.normalized}`)
      return Boolean(owners && Array.from(owners).some(source => source !== dossier.source))
    })
    if (!sharedWithOtherSource) entry.uniqueByAnchor += 1
    out[dossier.source] = entry
  }
  return out
}
