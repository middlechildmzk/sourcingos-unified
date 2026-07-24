'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { trackEvent } from '@/lib/analytics'
import { buildVolumeSearchPlan, type SearchMode } from '@/lib/search/volume-plan'

const modes: SearchMode[] = ['precision', 'balanced', 'broad', 'market_map']

function chipsFromQuery(query: string) {
  const terms = query.split(/[^a-zA-Z0-9+#/.]+/).map(t => t.trim()).filter(Boolean)
  const lower = query.toLowerCase()
  const chips: { canonical: string; type: string }[] = []
  const add = (canonical: string, type: string) => {
    if (!chips.some(c => c.canonical.toLowerCase() === canonical.toLowerCase() && c.type === type)) chips.push({ canonical, type })
  }

  for (const term of terms) {
    const t = term.toLowerCase()
    if (['engineer', 'developer', 'architect', 'analyst', 'recruiter', 'sourcer', 'scientist'].includes(t)) add(term, 'title')
    if (['kubernetes', 'terraform', 'aws', 'python', 'pytorch', 'react', 'typescript', 'java', 'sql', 'epic', 'fhir', 'hl7', 'splunk', 'docker', 'helm', 'argocd'].includes(t)) add(term, 'skill')
    if (['remote', 'virginia', 'minnesota', 'dc', 'texas', 'california'].includes(t)) add(term, 'location')
    if (['ts/sci', 'secret', 'clearance', 'poly', 'top'].includes(t)) add(term, 'clearance')
  }
  if (lower.includes('devsecops')) add('DevSecOps Engineer', 'title')
  if (lower.includes('machine learning') || lower.includes('ml engineer')) add('Machine Learning Engineer', 'title')
  if (lower.includes('healthcare')) add('Healthcare', 'industry')
  if (lower.includes('govcon')) add('GovCon', 'industry')
  if (lower.includes('ai') || lower.includes('llm') || lower.includes('hugging face')) add('AI/ML', 'industry')
  return chips
}

export function SearchLaneExpanderClient() {
  const [query, setQuery] = useState('DevSecOps Engineer Kubernetes Terraform AWS GovCloud TS/SCI Northern Virginia')
  const chips = useMemo(() => chipsFromQuery(query), [query])
  const plans = useMemo(() => modes.map(mode => buildVolumeSearchPlan({ rawQuery: query, chips, recommendedSourceIds: [], mode })), [query, chips])

  return <div>
    <div className="wb-form-row full" style={{ marginBottom: '16px' }}>
      <label>Role, skills, market, or rough search target</label>
      <textarea value={query} onChange={e => {
        setQuery(e.target.value)
        trackEvent('tool_used', { tool: 'search-lane-expander', action: 'query_changed' })
      }} style={{ minHeight: '86px' }} />
    </div>

    <div className="preview-banner" style={{ marginBottom: '16px' }}>
      <span className="pb-icon">◈</span>
      <span><strong>Trust note:</strong> This expands search lanes and public-source queries. It does not return verified candidates, scrape profiles, or confirm identity, clearance, availability, or contact accuracy.</span>
    </div>

    <div className="grid two">
      {plans.map(plan => <div className="card authority-card" key={plan.mode}>
        <span className="kicker">{plan.modeLabel}</span>
        <h3>{plan.modeLabel} lane</h3>
        <p className="muted">Per-source cap: {plan.sourceLimit}. Live source lanes: {plan.liveSources.join(', ')}.</p>
        <div className="jd-summary-grid" style={{ marginTop: '12px' }}>
          <div className="jd-summary-item"><span className="jd-summary-label">Live sources</span><span>{plan.liveSources.length}</span></div>
          <div className="jd-summary-item"><span className="jd-summary-label">Manual-safe lanes</span><span>{plan.manualSafeLanes.length}</span></div>
          <div className="jd-summary-item"><span className="jd-summary-label">Query variants</span><span>{plan.queryVariants.map(v => v.label).join(', ')}</span></div>
        </div>
        <div style={{ marginTop: '12px' }}>
          <div className="composer-section-label">Suggested searches</div>
          <ul style={{ color: 'var(--muted)', lineHeight: 1.65, paddingLeft: '18px' }}>
            {plan.queryVariants.map(v => <li key={v.id}><strong>{v.label}:</strong> {v.query}</li>)}
          </ul>
        </div>
        <div style={{ marginTop: '12px' }}>
          <div className="composer-section-label">Manual-safe lanes</div>
          <ul style={{ color: 'var(--muted)', lineHeight: 1.65, paddingLeft: '18px' }}>
            {plan.manualSafeLanes.slice(0, 4).map(lane => <li key={lane.id}><a href={lane.href} target="_blank" rel="noreferrer noopener" onClick={() => trackEvent('manual_safe_lane_opened', { tool: 'search-lane-expander', lane: lane.id, mode: plan.mode })}>{lane.label}</a>: {lane.note}</li>)}
          </ul>
        </div>
      </div>)}
    </div>

    <div className="cta" style={{ marginTop: '24px' }}>
      <strong>Next step:</strong> take the best lane into Candidate Search, then use the Market Map summary to see source coverage, no-result sources, and manual-safe next actions.{' '}
      <Link href="/candidate-search" style={{ textDecoration: 'underline' }} onClick={() => trackEvent('tool_used', { tool: 'search-lane-expander', action: 'open_candidate_search' })}>Open Candidate Search →</Link>
    </div>
  </div>
}
