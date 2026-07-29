'use client'
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import type { SourceStatus } from '@/lib/search/source-timeout'
import {
  diagnosticsHealthLabel,
  diagnosticsStrategyLabel,
  subscribeSourceDiagnostics,
  type SourceExecutionDiagnostics,
} from '@/lib/search/source-diagnostics'

export interface SourceLane {
  source: string
  status: SourceStatus
  count?: number
  href?: string
}

const STATUS_META: Record<SourceStatus, { label: string; color: string; dot: string }> = {
  queued:      { label: 'Queued',      color: 'var(--muted)',  dot: '◷' },
  searching:   { label: 'Searching…',  color: 'var(--accent)', dot: '⟳' },
  found:       { label: 'results',     color: 'var(--green)',  dot: '●' },
  no_results:  { label: 'No results',  color: 'var(--muted)',  dot: '○' },
  timed_out:   { label: 'Timed out',   color: '#f6c96b',       dot: '⏱' },
  error:       { label: 'Error',       color: '#f88',          dot: '✕' },
  manual_safe: { label: 'Manual-safe', color: '#b8a8ff',       dot: '◈' },
  planned:     { label: 'Planned',     color: 'var(--muted)',  dot: '◌' },
  skipped:     { label: 'Skipped',     color: 'var(--muted)',  dot: '–' },
}

interface SourceLaneStatusProps {
  lanes: SourceLane[]
  onRetry?: (source: string) => void
}

function durationLabel(durationMs: number): string {
  if (durationMs < 1000) return `${Math.max(0, Math.round(durationMs))} ms`
  return `${(durationMs / 1000).toFixed(1)} s`
}

function rateResetLabel(value?: string): string {
  if (!value) return ''
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

export function SourceLaneStatus({ lanes, onRetry }: SourceLaneStatusProps) {
  const [diagnosticsBySource, setDiagnosticsBySource] = useState<Record<string, SourceExecutionDiagnostics>>({})
  const laneStateKey = useMemo(
    () => lanes.map(lane => `${lane.source}:${lane.status}`).join('|'),
    [lanes],
  )

  useEffect(() => subscribeSourceDiagnostics(diagnostics => {
    setDiagnosticsBySource(previous => ({ ...previous, [diagnostics.source]: diagnostics }))
  }), [])

  useEffect(() => {
    setDiagnosticsBySource(previous => {
      let changed = false
      const next = { ...previous }
      lanes.forEach(lane => {
        if ((lane.status === 'queued' || lane.status === 'searching') && next[lane.source]) {
          delete next[lane.source]
          changed = true
        }
      })
      return changed ? next : previous
    })
  }, [laneStateKey, lanes])

  if (lanes.length === 0) return null

  const running = lanes.some(lane => lane.status === 'queued' || lane.status === 'searching')
  const found = lanes.filter(lane => lane.status === 'found')
  const resultCount = found.reduce((sum, lane) => sum + (lane.count || 0), 0)
  const manualCount = lanes.filter(lane => lane.status === 'manual_safe').length
  const issueSources = new Set(
    lanes
      .filter(lane => lane.status === 'timed_out' || lane.status === 'error')
      .map(lane => lane.source),
  )
  lanes.forEach(lane => {
    const diagnostics = diagnosticsBySource[lane.source]
    if (diagnostics && diagnostics.health !== 'healthy') issueSources.add(lane.source)
  })

  return (
    <details className="lane-status-disclosure">
      <summary>
        <span>{running ? 'Source coverage still updating' : 'Source coverage'}</span>
        <span className="lane-status-compact">
          <span>{resultCount} profiles</span>
          <span>{found.length} live sources</span>
          {!!manualCount && <span>{manualCount} manual lanes</span>}
          {!!issueSources.size && <span>{issueSources.size} need attention</span>}
        </span>
      </summary>
      <div className="lane-status">
        {lanes.map(lane => {
          const meta = STATUS_META[lane.status]
          const showCount = lane.status === 'found' && typeof lane.count === 'number'
          const diagnostics = diagnosticsBySource[lane.source]
          const resetLabel = rateResetLabel(diagnostics?.rateLimitResetAt)
          return (
            <div key={lane.source} className="lane-chip" style={{ borderColor: `${meta.color}33`, flexWrap: 'wrap' }}>
              <span className="lane-dot" style={{ color: meta.color }}>{meta.dot}</span>
              <span className="lane-source">{lane.source}</span>
              <span className="lane-state" style={{ color: meta.color }}>
                {showCount ? `${lane.count} ${meta.label}` : meta.label}
              </span>
              {lane.status === 'timed_out' && onRetry && (
                <button className="lane-retry" onClick={() => onRetry(lane.source)}>retry</button>
              )}
              {lane.status === 'manual_safe' && lane.href && (
                <Link className="lane-retry" href={lane.href}>open</Link>
              )}
              {diagnostics && lane.status !== 'queued' && lane.status !== 'searching' && (
                <details
                  style={{ flexBasis: '100%', marginTop: 6, paddingTop: 6, borderTop: '1px solid var(--border)' }}
                  aria-label={`${lane.source} source execution details`}
                >
                  <summary style={{ cursor: 'pointer', fontSize: 11, color: 'var(--muted)' }}>Source details</summary>
                  <div style={{ display: 'grid', gap: 4, marginTop: 6, fontSize: 11, lineHeight: 1.45 }}>
                    <span>
                      {diagnosticsStrategyLabel(diagnostics.strategy)} · {diagnosticsHealthLabel(diagnostics.health)} · {durationLabel(diagnostics.durationMs)}
                    </span>
                    <span>{diagnostics.personCount} people · {diagnostics.nonPersonCount} non-person subjects excluded from candidate counts</span>
                    {typeof diagnostics.repositoriesExamined === 'number' && (
                      <span>
                        {diagnostics.repositoriesExamined} repositories · {diagnostics.contributorsExamined || 0} contributors reviewed · {diagnostics.profilesHydrated || 0} profiles hydrated
                      </span>
                    )}
                    {typeof diagnostics.skippedBots === 'number' && diagnostics.skippedBots > 0 && (
                      <span>{diagnostics.skippedBots} bot accounts excluded</span>
                    )}
                    {typeof diagnostics.rateLimitRemaining === 'number' && (
                      <span>
                        GitHub API remaining: {diagnostics.rateLimitRemaining}{resetLabel ? ` · resets around ${resetLabel}` : ''}
                      </span>
                    )}
                    <span style={{ overflowWrap: 'anywhere' }}>Effective query: {diagnostics.effectiveQuery || 'Not applicable'}</span>
                    {diagnostics.partial && <span>Partial source execution. Review warnings before relying on coverage.</span>}
                    {diagnostics.warnings?.slice(0, 2).map(warning => (
                      <span key={warning} role="status">{warning}</span>
                    ))}
                  </div>
                </details>
              )}
            </div>
          )
        })}
      </div>
    </details>
  )
}
