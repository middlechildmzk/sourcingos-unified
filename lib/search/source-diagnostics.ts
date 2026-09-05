export type SourceExecutionHealth = 'healthy' | 'degraded' | 'rate_limited' | 'error'

export type SourceExecutionDiagnostics = {
  source: string
  strategy: string
  health: SourceExecutionHealth
  effectiveQuery: string
  durationMs: number
  resultCount: number
  personCount: number
  nonPersonCount: number
  partial: boolean
  rateLimitRemaining?: number
  rateLimitResetAt?: string
  repositoriesExamined?: number
  contributorsExamined?: number
  profilesHydrated?: number
  skippedBots?: number
  warnings?: string[]
}

type DiagnosticsListener = (diagnostics: SourceExecutionDiagnostics) => void

const listeners = new Set<DiagnosticsListener>()

export function isSourceExecutionDiagnostics(value: unknown): value is SourceExecutionDiagnostics {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<SourceExecutionDiagnostics>
  return typeof candidate.source === 'string'
    && typeof candidate.strategy === 'string'
    && ['healthy', 'degraded', 'rate_limited', 'error'].includes(String(candidate.health))
    && typeof candidate.effectiveQuery === 'string'
    && typeof candidate.durationMs === 'number'
    && typeof candidate.resultCount === 'number'
    && typeof candidate.personCount === 'number'
    && typeof candidate.nonPersonCount === 'number'
    && typeof candidate.partial === 'boolean'
}

export function publishSourceDiagnostics(value: unknown): void {
  if (!isSourceExecutionDiagnostics(value)) return
  listeners.forEach(listener => listener(value))
}

export function subscribeSourceDiagnostics(listener: DiagnosticsListener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function diagnosticsStrategyLabel(strategy: string): string {
  if (strategy === 'repository_contributors') return 'Repository contributors'
  if (strategy === 'user_search_fallback') return 'User-search fallback'
  if (strategy === 'manual_safe') return 'Manual-safe lane'
  return 'Source connector'
}

export function diagnosticsHealthLabel(health: SourceExecutionHealth): string {
  if (health === 'rate_limited') return 'Rate limited'
  return health[0].toUpperCase() + health.slice(1)
}
