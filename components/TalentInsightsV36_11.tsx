'use client'

import { useMemo, useState } from 'react'
import { buildUniversalPeopleProviderRequestV36_9 } from '@/lib/universal-people-search-v36-9'

type Telemetry = {
  provider: string
  status: 'completed' | 'failed' | 'unavailable' | 'skipped'
  discovered: number
  latencyMs: number
  message?: string
}

type SearchResponse = {
  ok?: boolean
  error?: string
  telemetry?: Telemetry[]
  providerMix?: Record<string, number>
  retainedProviderMix?: Record<string, number>
  discoveredBeforeCap?: number
  returnedAfterCap?: number
  contributingProviders?: number
  warnings?: string[]
}

function split(value: string): string[] {
  return value.split(/[,\n;]/).map(item => item.trim()).filter(Boolean)
}

function yearsFloor(value: string): number | undefined {
  const match = value.match(/\b(\d{1,2})\s*\+?\s*(?:years?|yrs?)\b/i)
  return match ? Number(match[1]) : undefined
}

function hasClearance(value: string): boolean {
  return /\b(?:TS\s*\/\s*SCI|TS\s+SCI|Top Secret|Secret|Confidential|Public Trust)\b/i.test(value)
}

function difficultyLabel(score: number): string {
  if (score >= 75) return 'Very hard'
  if (score >= 55) return 'Hard'
  if (score >= 30) return 'Moderate'
  return 'Broad / lower constraint'
}

function displayProvider(value: string): string {
  return value.split('_').map(part => part ? part[0].toUpperCase() + part.slice(1) : '').join(' ')
}

export function TalentInsightsV36_11() {
  const [query, setQuery] = useState('DevOps engineer with 10+ years and Secret clearance')
  const [title, setTitle] = useState('DevOps Engineer')
  const [location, setLocation] = useState('Washington, DC')
  const [skills, setSkills] = useState('AWS, Terraform, Kubernetes')
  const [working, setWorking] = useState(false)
  const [status, setStatus] = useState('')
  const [result, setResult] = useState<SearchResponse | null>(null)

  const draft = useMemo(() => buildUniversalPeopleProviderRequestV36_9({
    query,
    title,
    location,
    skills,
    limit: 30,
  }), [location, query, skills, title])

  const pressure = useMemo(() => {
    let score = 0
    const years = yearsFloor(query)
    if (hasClearance(query)) score += 25
    if (years !== undefined) score += years >= 10 ? 18 : years >= 5 ? 10 : 5
    if (location.trim()) score += 10
    const hardRequirements = (draft.requirements || []).filter(item => item.mustHave).length
    score += Math.min(25, hardRequirements * 6)
    const returned = result?.returnedAfterCap ?? 0
    const providers = result?.contributingProviders ?? 0
    if (result) {
      if (returned < 5) score += 15
      else if (returned < 12) score += 8
      else if (returned >= 20 && providers >= 3) score -= 10
      if (providers <= 1) score += 8
    }
    return Math.max(0, Math.min(100, score))
  }, [draft.requirements, location, query, result])

  const strategy = useMemo(() => {
    const items: string[] = []
    if (hasClearance(query)) items.push('Treat clearance as a verification-required requirement. Use it to guide discovery, but do not infer active clearance from employer, location, or job history alone.')
    if (location.trim()) items.push(`Start with ${location.trim()} and explicitly approved commuting/adjacent markets before relaxing a true must-have.`)
    if (split(title).length) items.push('Build an adjacent-title lane alongside the approved title so provider taxonomy differences do not hide otherwise relevant people.')
    if (split(skills).length >= 3) items.push('Keep true must-have skills separate from discovery-expansion skills; avoid turning every keyword into an AND requirement.')
    const returned = result?.returnedAfterCap ?? 0
    const providers = result?.contributingProviders ?? 0
    if (result && providers <= 1) items.push('Do not draw a market conclusion yet: too few provider lanes contributed. Validate credentials/API compatibility and rerun before changing the search strategy.')
    if (result && returned < 5) items.push('The observed sample is thin. Broaden titles and geography first, then revisit experience/skill constraints with the hiring team if the true pool remains narrow.')
    if (result && returned >= 12) items.push('There is enough observed breadth for calibration. Review a small sample before expanding further so recruiter feedback can improve the next pass.')
    if (!items.length) items.push('Run the market sample, review source contribution, then calibrate the search before changing requirements.')
    return items.slice(0, 6)
  }, [location, query, result, skills, title])

  async function analyze() {
    if (working) return
    if (!query.trim() && !title.trim() && !skills.trim() && !location.trim()) {
      setStatus('Enter a role, requirements, skills, or location first.')
      return
    }
    setWorking(true)
    setResult(null)
    setStatus('Sampling the connected professional talent universe…')
    try {
      const response = await fetch('/api/candidate-data/search', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(draft),
      })
      const json = await response.json() as SearchResponse
      if (!response.ok || !json.ok) throw new Error(json.error || 'Talent market sample failed.')
      setResult(json)
      setStatus(`Observed ${json.discoveredBeforeCap ?? 0} provider rows and retained ${json.returnedAfterCap ?? 0} across ${json.contributingProviders ?? 0} contributing provider lanes.`)
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Talent market sample failed.')
    } finally {
      setWorking(false)
    }
  }

  return <>
    <section className="product-panel" style={{ marginBottom: 16 }}>
      <div className="product-panel-head" style={{ alignItems: 'flex-start' }}>
        <div>
          <span className="kicker">Role market diagnostic · V36.11</span>
          <h2 style={{ marginBottom: 6 }}>Describe the role, then sample the connected talent universe.</h2>
          <p className="muted" style={{ margin: 0, maxWidth: 820 }}>
            This first version reports actual provider discoveries and source contribution. It does not claim those rows are unique humans or pretend a capped search sample is the total addressable market.
          </p>
        </div>
        <span className="status-pill active">observed market sample</span>
      </div>

      <label style={{ display: 'block', marginTop: 18 }}>
        <span className="kicker">Role / natural-language requirements</span>
        <textarea value={query} onChange={event => setQuery(event.target.value)} rows={4} style={{ width: '100%', marginTop: 6 }} placeholder="DevOps engineer with 10+ years and Secret clearance..." />
      </label>
      <div className="grid two" style={{ marginTop: 12 }}>
        <label><span className="kicker">Titles</span><input value={title} onChange={event => setTitle(event.target.value)} style={{ width: '100%', marginTop: 5 }} placeholder="DevOps Engineer" /></label>
        <label><span className="kicker">Location</span><input value={location} onChange={event => setLocation(event.target.value)} style={{ width: '100%', marginTop: 5 }} placeholder="Washington, DC" /></label>
        <label style={{ gridColumn: '1 / -1' }}><span className="kicker">Skills / keywords</span><input value={skills} onChange={event => setSkills(event.target.value)} style={{ width: '100%', marginTop: 5 }} placeholder="AWS, Terraform, Kubernetes" /></label>
      </div>
      <div className="button-row" style={{ marginTop: 14 }}>
        <button className="btn" disabled={working} onClick={() => void analyze()}>{working ? 'Analyzing…' : 'Analyze talent market'}</button>
        <span className="muted" style={{ fontSize: 12 }}>Provider retrieval ≠ qualification · observed rows ≠ unique people · clearance breadcrumbs remain unverified</span>
      </div>
      {status && <div className="cta" role="status" style={{ marginTop: 14, marginBottom: 0 }}>{status}</div>}
    </section>

    <div className="grid two">
      <section className="product-panel">
        <span className="kicker">Early search difficulty signal</span>
        <h2 style={{ marginBottom: 4 }}>{difficultyLabel(pressure)}</h2>
        <p className="muted" style={{ marginTop: 0 }}>Constraint pressure {pressure}/100</p>
        <div style={{ height: 8, borderRadius: 999, background: 'var(--surface-2, rgba(127,127,127,.15))', overflow: 'hidden', margin: '12px 0' }}>
          <div style={{ width: `${pressure}%`, height: '100%', background: 'currentColor', opacity: .7 }} />
        </div>
        <p className="muted" style={{ fontSize: 13, lineHeight: 1.6 }}>
          This is a transparent heuristic from requirement pressure plus observed search breadth. It is not a vendor market-size claim and should not replace recruiter judgment.
        </p>
      </section>

      <section className="product-panel">
        <span className="kicker">Observed market breadth</span>
        <div className="agentic-run-metrics" style={{ marginTop: 12 }}>
          <span><b>{result?.discoveredBeforeCap ?? '—'}</b><small>provider rows</small></span>
          <span><b>{result?.returnedAfterCap ?? '—'}</b><small>retained sample</small></span>
          <span><b>{result?.contributingProviders ?? '—'}</b><small>providers contributed</small></span>
        </div>
        {!!result?.retainedProviderMix && <div className="chips" style={{ marginTop: 12 }}>
          {Object.entries(result.retainedProviderMix).map(([provider, count]) => <span className="tag" key={provider}>{displayProvider(provider)} · {count}</span>)}
        </div>}
      </section>
    </div>

    <section className="product-panel" style={{ marginTop: 16 }}>
      <span className="kicker">Recommended sourcing strategy</span>
      <h2>What to do next</h2>
      <ol style={{ margin: '12px 0 0', paddingLeft: 22, lineHeight: 1.7 }}>
        {strategy.map(item => <li key={item} style={{ marginBottom: 8 }}>{item}</li>)}
      </ol>
    </section>

    {!!result?.telemetry?.length && <details className="product-panel" style={{ marginTop: 16 }}>
      <summary style={{ cursor: 'pointer', fontWeight: 700 }}>Provider diagnostics</summary>
      <div className="agentic-source-status-row" style={{ marginTop: 12 }}>
        {result.telemetry.map(item => <span key={item.provider} className={`status-pill ${item.status === 'completed' ? 'success' : item.status === 'failed' ? 'warning' : ''}`}>{displayProvider(item.provider)} · {item.status} · {item.discovered}</span>)}
      </div>
      {!!result.warnings?.length && <div className="cta" style={{ marginTop: 12, marginBottom: 0 }}>{result.warnings.join(' ')}</div>}
    </details>}
  </>
}
