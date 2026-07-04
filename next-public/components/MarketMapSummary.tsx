import type { MarketMapSnapshot } from '@/lib/search/volume-plan'

export function MarketMapSummary({ snapshot }: { snapshot: MarketMapSnapshot | null }) {
  if (!snapshot) return null

  const breakdown = Object.entries(snapshot.sourceBreakdown)
  const noResultSources = breakdown.filter(([, count]) => count === 0).map(([source]) => source)
  const foundSources = breakdown.filter(([, count]) => count > 0)

  return (
    <div className="jd-summary" style={{ marginBottom: '16px' }}>
      <div className="jd-summary-head">Market map summary — {snapshot.modeLabel}</div>
      <p className="muted" style={{ margin: '6px 0 12px', lineHeight: 1.55 }}>
        Showing public-source discovery, not confirmed candidates. Low volume does not mean no market. It may mean the query is too title-heavy, too location-heavy, or better suited for manual-safe X-Ray and donor-company lanes.
      </p>

      <div className="jd-summary-grid" style={{ marginBottom: '12px' }}>
        <div className="jd-summary-item"><span className="jd-summary-label">Public source profiles found</span><span>{snapshot.totalResults}</span></div>
        <div className="jd-summary-item"><span className="jd-summary-label">Live sources searched</span><span>{snapshot.liveSources.join(', ') || 'None'}</span></div>
        <div className="jd-summary-item"><span className="jd-summary-label">Manual-safe lanes prepared</span><span>{snapshot.manualSafeLanes.length}</span></div>
        <div className="jd-summary-item"><span className="jd-summary-label">Unverified</span><span>{snapshot.unverified.join(', ')}</span></div>
      </div>

      <div className="grid two">
        <div className="card">
          <span className="kicker">Source breakdown</span>
          <h3>Where public evidence came from</h3>
          <ul style={{ margin: '10px 0 0', paddingLeft: '18px', color: 'var(--muted)', lineHeight: 1.7 }}>
            {breakdown.map(([source, count]) => <li key={source}>{source}: {count} result{count === 1 ? '' : 's'}</li>)}
          </ul>
          {foundSources.length === 0 && <p className="muted">No live source profiles yet. Use rescue actions and manual-safe lanes below.</p>}
        </div>
        <div className="card">
          <span className="kicker">Query variants used</span>
          <h3>How SourcingOS broadened the search</h3>
          <ul style={{ margin: '10px 0 0', paddingLeft: '18px', color: 'var(--muted)', lineHeight: 1.7 }}>
            {snapshot.queryVariants.map(v => <li key={v.id}><strong>{v.label}:</strong> {v.note}</li>)}
          </ul>
        </div>
      </div>

      {snapshot.manualSafeLanes.length > 0 && (
        <div className="card" style={{ marginTop: '12px' }}>
          <span className="kicker">Manual-safe discovery lanes</span>
          <h3>Keep sourcing without scraping or fake volume</h3>
          <div className="grid two">
            {snapshot.manualSafeLanes.map(lane => <a className="card" href={lane.href} target="_blank" rel="noreferrer noopener" key={lane.id}>
              <span className="kicker">Manual-safe discovery lane</span>
              <h3>{lane.label}</h3>
              <p className="muted">{lane.note}</p>
              <span className="kicker" style={{ color: 'var(--muted)' }}>Open search →</span>
            </a>)}
          </div>
        </div>
      )}

      {(snapshot.totalResults < 3 || noResultSources.length > 0) && (
        <div className="preview-banner" style={{ marginTop: '12px', borderColor: 'rgba(246,201,107,.35)' }}>
          <span className="pb-icon">◈</span>
          <span>
            <strong>Low-result rescue:</strong> {snapshot.lowResultActions.join(' ')}
          </span>
        </div>
      )}
    </div>
  )
}
