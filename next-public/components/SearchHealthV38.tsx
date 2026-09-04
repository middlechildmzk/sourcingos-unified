'use client'

export type SearchHealthSessionV38 = {
  discoveryExpansion: Array<{ type: string; value: string; reason: string; searchOnly: true; evidenceEligible: false }>
  providerRequests: Array<{
    provider: string
    titles: string[]
    skills: string[]
    locations: string[]
    companies: string[]
    names: string[]
    limit: number
    intentionallyNotSentAsQualificationKeywords: string[]
    secretsExposed: false
  }>
  providerHealth: Array<{
    provider: string
    category: string
    discovered: number
    retained: number
    latencyMs: number
    runtimeCapability: string
    message?: string
  }>
  providerSummary: {
    selected: number
    successful: number
    zeroResults: number
    degraded: number
    unavailable: number
    failed: number
  }
  funnel: {
    rawDiscoveries: number
    relevanceAdmitted: number
    relevanceRejected: number
    finalRetained: number
    contributingProviders: number
  }
}

function label(value: string) {
  return value.split('_').map(part => part ? part[0].toUpperCase() + part.slice(1).toLowerCase() : '').join(' ')
}

function compact(values: string[], max = 5) {
  if (!values.length) return '—'
  const visible = values.slice(0, max).join(', ')
  return values.length > max ? `${visible} +${values.length - max}` : visible
}

export function SearchHealthV38({ quality }: { quality: SearchHealthSessionV38 }) {
  return <details className="search-health-v38">
    <summary>
      <span>Search health</span>
      <div className="search-health-summary-badges">
        <small>{quality.providerSummary.successful}/{quality.providerSummary.selected} providers healthy</small>
        <small>{quality.funnel.rawDiscoveries} → {quality.funnel.finalRetained} retained</small>
      </div>
    </summary>
    <div className="search-health-body">
      <div className="search-health-funnel">
        <div><small>Discovered</small><b>{quality.funnel.rawDiscoveries}</b></div>
        <div><small>Admitted</small><b>{quality.funnel.relevanceAdmitted}</b></div>
        <div><small>Filtered</small><b>{quality.funnel.relevanceRejected}</b></div>
        <div><small>Retained</small><b>{quality.funnel.finalRetained}</b></div>
      </div>

      <div className="search-health-grid">
        <section className="search-health-block">
          <h4>Provider runtime truth</h4>
          <div className="search-health-provider-list">
            {quality.providerHealth.map(item => <div className="search-health-provider" key={item.provider} title={item.message || ''}>
              <strong>{label(item.provider)}</strong>
              <span>{item.discovered} discovered · {item.retained} retained · {item.latencyMs}ms</span>
              <code data-state={item.category}>{item.category}</code>
            </div>)}
          </div>
        </section>

        <section className="search-health-block">
          <h4>Discovery expansion</h4>
          {quality.discoveryExpansion.length
            ? <div className="search-health-expansion">{quality.discoveryExpansion.slice(0, 12).map(item => <span key={`${item.type}:${item.value}`} title={item.reason}>{item.value}</span>)}</div>
            : <p className="search-health-expansion-empty">No bounded expansion was added to this search.</p>}
        </section>
      </div>

      <details className="search-health-inspector">
        <summary>Inspect sanitized provider execution context</summary>
        <div className="search-health-request-list">
          {quality.providerRequests.map(item => <article className="search-health-request" key={item.provider}>
            <header><strong>{label(item.provider)}</strong><span>limit {item.limit}</span></header>
            <p><b>Titles:</b> {compact(item.titles)}</p>
            <p><b>Skills:</b> {compact(item.skills)}</p>
            <p><b>Locations:</b> {compact(item.locations)}</p>
            {!!item.companies.length && <p><b>Companies:</b> {compact(item.companies)}</p>}
            {!!item.intentionallyNotSentAsQualificationKeywords.length && <p><b>Qualification text kept separate:</b> {compact(item.intentionallyNotSentAsQualificationKeywords, 4)}</p>}
          </article>)}
        </div>
      </details>

      <p className="search-health-trust">Execution context shows the normalized search inputs available to the adapter; it is not a claim that every vendor received every field verbatim. Runtime health explains what the search infrastructure did. It is not candidate qualification. Discovery expansion remains search-only, and missing requirement evidence remains unknown.</p>
    </div>
  </details>
}
