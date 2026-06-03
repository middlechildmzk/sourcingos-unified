'use client'
import Link from 'next/link'
import type { SourceStatus } from '@/lib/search/source-timeout'

export interface SourceLane {
  source: string
  status: SourceStatus
  count?: number
  href?: string   // manual-safe lanes link to a workflow
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

export function SourceLaneStatus({ lanes, onRetry }: SourceLaneStatusProps) {
  if (lanes.length === 0) return null
  return (
    <div className="lane-status">
      {lanes.map(lane => {
        const meta = STATUS_META[lane.status]
        const showCount = lane.status === 'found' && typeof lane.count === 'number'
        return (
          <div key={lane.source} className="lane-chip" style={{ borderColor: `${meta.color}33` }}>
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
          </div>
        )
      })}
    </div>
  )
}
