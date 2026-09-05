import 'server-only'

import { retrievalCapabilityTerms } from '../explicit-role-requirements-v33-6'
import type { SourceResult } from '../source-types'
import {
  discoveryIntent,
  newRunReport,
  type ConnectorRunReport,
  type DiscoveryIntent,
  type TechnicalDossier,
} from './contract-v33-3'
import { discoverGitHubTalent } from './github-v2'
import { ConnectorRequestLedger } from './request-ledger-v33-3'
import { enforceRetrievalBoundary, dossierToSourceResult } from './source-truth-v33-3'
import { discoverStackOverflowTalent } from './stackoverflow-v2'

export type ActivatedTechnicalSource = 'github' | 'stackoverflow'
export type TechnicalActivationMode = 'v2' | 'legacy_fallback'

export type TechnicalV2Input = {
  query: string
  skills?: readonly string[]
  location?: string
  limit: number
  runId?: string
}

export type TechnicalV2Result = {
  results: SourceResult[]
  report: ConnectorRunReport
  message?: string
}

export type TechnicalActivationResult = {
  results: SourceResult[]
  mode: TechnicalActivationMode
  degraded: boolean
  message?: string
}

export type ActivationBudget = {
  maxRequests: number
  timeoutMs: number
  maxRepositories?: number
  maxPeople: number
}

function clean(value: string | undefined): string {
  return String(value || '').trim()
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown connector error.'
}

function joinMessage(...parts: Array<string | undefined>): string | undefined {
  const text = parts.map(clean).filter(Boolean).join(' ')
  return text ? text.slice(0, 240) : undefined
}

/**
 * Deliberately small per-run budgets. Connector quota state is operational
 * telemetry, never a candidate-ranking signal.
 */
export function technicalActivationBudget(
  source: ActivatedTechnicalSource,
  credentialed = false,
): ActivationBudget {
  if (source === 'github') {
    return credentialed
      ? { maxRequests: 24, timeoutMs: 9_000, maxRepositories: 4, maxPeople: 6 }
      : { maxRequests: 12, timeoutMs: 8_000, maxRepositories: 3, maxPeople: 3 }
  }
  return { maxRequests: 12, timeoutMs: 9_000, maxPeople: 8 }
}

/**
 * Search Brain / recruiter language becomes retrieval intent only. Quantified
 * requirements stay in Role Brief truth while the connector receives the
 * underlying capability (e.g. 5+ years Linux experience -> Linux). Neither form
 * can be assigned to SourceResult evidence by this adapter.
 */
export function technicalDiscoveryIntent(input: TechnicalV2Input): DiscoveryIntent {
  return discoveryIntent({
    hypothesis: input.query,
    capabilityTerms: retrievalCapabilityTerms(input.skills || []),
    location: input.location,
    limit: input.limit,
    runId: input.runId,
  })
}

/**
 * Runtime trust gate immediately before the Candidate Graph's canonical
 * SourceResult shape. Contaminated observations are removed, never silently
 * promoted from search criteria into candidate facts.
 */
export function canonicalizeTechnicalDossiers(
  dossiers: readonly TechnicalDossier[],
  intent: DiscoveryIntent,
  report: ConnectorRunReport,
): SourceResult[] {
  return dossiers.map(dossier => {
    const boundary = enforceRetrievalBoundary(dossier, intent)
    if (boundary.removed.length) {
      report.partial = true
      const fields = boundary.removed.map(item => item.field).slice(0, 4).join(', ')
      const warning = `Removed ${boundary.removed.length} retrieval-contaminated observation${boundary.removed.length === 1 ? '' : 's'} before Candidate Graph ingestion${fields ? ` (${fields})` : ''}.`
      if (!report.warnings.includes(warning)) report.warnings.push(warning)
    }
    return dossierToSourceResult(boundary.dossier)
  })
}

function reportMessage(label: string, report: ConnectorRunReport, extra?: string): string | undefined {
  const warnings = report.warnings.slice(0, 2).join(' ')
  const quota = report.quotaRemaining === null ? undefined : `${label} quota remaining: ${report.quotaRemaining}.`
  const partial = report.partial ? `${label} V2 returned a partial result set.` : undefined
  return joinMessage(extra, partial, warnings, quota)
}

export async function runGitHubV2(input: TechnicalV2Input): Promise<TechnicalV2Result> {
  const token = clean(process.env.GITHUB_API_TOKEN || process.env.GITHUB_TOKEN)
  const credentialed = Boolean(token)
  const budget = technicalActivationBudget('github', credentialed)
  const report = newRunReport('github')
  const ledger = new ConnectorRequestLedger({
    sourceKey: 'github',
    report,
    maxRequests: budget.maxRequests,
    timeoutMs: budget.timeoutMs,
  })
  const intent = technicalDiscoveryIntent({ ...input, limit: Math.min(input.limit, budget.maxPeople) })
  const started = Date.now()

  const outcome = await discoverGitHubTalent(intent, {
    ledger,
    token: token || undefined,
    maxRepositories: budget.maxRepositories,
    maxPeople: Math.min(input.limit, budget.maxPeople),
    repoLimit: credentialed ? 20 : 12,
  })
  report.durationMs = Date.now() - started
  const results = canonicalizeTechnicalDossiers(outcome.dossiers, intent, report)
  report.evidenceItemsProduced = results.reduce((sum, result) => sum + result.evidence.length, 0)

  const credentialNote = credentialed
    ? undefined
    : 'GitHub V2 is running in bounded anonymous mode; contribution-history depth is limited.'
  return { results, report, message: reportMessage('GitHub', report, credentialNote) }
}

export async function runStackOverflowV2(input: TechnicalV2Input): Promise<TechnicalV2Result> {
  const budget = technicalActivationBudget('stackoverflow')
  const report = newRunReport('stackoverflow')
  const ledger = new ConnectorRequestLedger({
    sourceKey: 'stackoverflow',
    report,
    maxRequests: budget.maxRequests,
    timeoutMs: budget.timeoutMs,
  })
  const intent = technicalDiscoveryIntent({ ...input, limit: Math.min(input.limit, budget.maxPeople) })
  const started = Date.now()

  const outcome = await discoverStackOverflowTalent(intent, {
    ledger,
    maxPeople: Math.min(input.limit, budget.maxPeople),
  })
  report.durationMs = Date.now() - started
  const results = canonicalizeTechnicalDossiers(outcome.dossiers, intent, report)
  report.evidenceItemsProduced = results.reduce((sum, result) => sum + result.evidence.length, 0)

  return { results, report, message: reportMessage('Stack Overflow', report) }
}

/**
 * Activation gate shared by both technical sources. V2 gets first opportunity;
 * the known production connector remains a safety net until measured source
 * quality proves V2 can stand alone.
 */
export async function preferTechnicalV2(input: {
  source: ActivatedTechnicalSource
  runV2: () => Promise<TechnicalV2Result>
  runFallback: () => Promise<{ results: SourceResult[]; message?: string }>
}): Promise<TechnicalActivationResult> {
  let primaryMessage: string | undefined
  try {
    const primary = await input.runV2()
    primaryMessage = primary.message
    const people = primary.results.filter(result => result.entityKind === 'person')
    if (people.length) {
      return {
        results: people,
        mode: 'v2',
        degraded: Boolean(primary.report.partial),
        message: primary.message,
      }
    }
    primaryMessage = joinMessage(primary.message, `${input.source} V2 returned no eligible people; the existing connector was used as fallback.`)
  } catch (error) {
    primaryMessage = `${input.source} V2 degraded: ${errorMessage(error).slice(0, 150)} Existing connector fallback was used.`
  }

  try {
    const fallback = await input.runFallback()
    return {
      results: fallback.results.filter(result => result.entityKind === 'person'),
      mode: 'legacy_fallback',
      degraded: true,
      message: joinMessage(primaryMessage, fallback.message),
    }
  } catch (fallbackError) {
    throw new Error(
      `${input.source} V2 and existing connector both failed. ${primaryMessage || ''} Fallback: ${errorMessage(fallbackError)}`.trim(),
    )
  }
}
