import type { MarketMapSnapshot } from '@/lib/search/volume-plan'

export function MarketMapSummary({ snapshot }: { snapshot: MarketMapSnapshot | null }) {
  if (!snapshot) return null

  const breakdown = Object.entries(snapshot.sourceBreakdown)
  const noResultSources = breakdown.filter(([, count]) => count === 0).map(([source]) => source)
  const foundSources = breakdown.filter(([, count]) => count > 0)

  return (
    <details className="market-map-summary">
      <summary>
        <span>Search diagnostics and market-map detail</span>
        <span className="lane-status-compact">
          <span>{snapshot.modeLabel}</span>
          <span>{snapshot.totalResults} profiles</span>
          <span>{foundSources.length} sources returned results</span>
        </span>
      </summary>

      <div className="market-map-content">
        <div className="market-map-metrics">
          <div className="market-map-metric"><small>Profiles found</small><strong>{snapshot.totalResults}</strong></div>
          <div className="market-map-metric"><small>Live sources</small><strong>{snapshot.liveSources.length}</strong></div>
          <div className="market-map-metric"><small>Manual lanes</small><strong>{snapshot.manualSafeLanes.length}</strong></div>
          <div className="market-map-metric"><small>No-result sources</small><strong>{noResultSources.length}</strong></div>
        </div>

        <div className="market-map-columns">
          <div className="market-map-block">
            <h4>Source breakdown</h4>
            <ul>
              {breakdown.map(([source, count]) => <li key={source}>{source}: {count} result{count === 1 ? '' : 's'}</li>)}
            </ul>
          </div>
          <div className="market-map-block">
            <h4>Query variants used</h4>
            <ul>
              {snapshot.queryVariants.map(variant => <li key={variant.id}><strong>{variant.label}:</strong> {variant.note}</li>)}
            </ul>
          </div>
        </div>

        {snapshot.manualSafeLanes.length > 0 && (
          <div className="market-map-lanes">
            {snapshot.manualSafeLanes.map(lane => (
              <a className="market-map-lane" href={lane.href} target="_blank" rel="noreferrer noopener" key={lane.id}>
                {lane.label} ↗
              </a>
            ))}
          </div>
        )}

        {(snapshot.totalResults < 3 || noResultSources.length > 0) && (
          <div className="market-map-block" style={{ marginTop: '10px' }}>
            <h4>Ways to broaden the search</h4>
            <div>{snapshot.lowResultActions.join(' ')}</div>
          </div>
        )}
      </div>
    </details>
  )
}
