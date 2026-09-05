'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'

type NumericFieldProps = {
  label: string
  value: number
  onChange: (value: number) => void
  min?: number
  help: string
}

function NumericField({ label, value, onChange, min = 0, help }: NumericFieldProps) {
  return <label style={{ display: 'block' }}>
    <span style={{ display: 'block', fontWeight: 800 }}>{label}</span>
    <span className="muted" style={{ display: 'block', fontSize: 13, margin: '3px 0 7px' }}>{help}</span>
    <input
      className="input"
      type="number"
      min={min}
      value={value}
      onChange={e => onChange(Math.max(min, Number(e.target.value) || 0))}
    />
  </label>
}

function ratio(num: number, den: number) {
  return den > 0 ? num / den : null
}

function pct(value: number | null) {
  return value == null ? '—' : `${Math.round(value * 100)}%`
}

export function SearchExhaustionCalculatorClient() {
  const [plannedLanes, setPlannedLanes] = useState(5)
  const [workedLanes, setWorkedLanes] = useState(3)
  const [recentSaved, setRecentSaved] = useState(20)
  const [alreadyKnown, setAlreadyKnown] = useState(9)
  const [newLeads, setNewLeads] = useState(5)
  const [activeHours, setActiveHours] = useState(3)
  const [archetypeLeads, setArchetypeLeads] = useState(10)
  const [archetypeUnique, setArchetypeUnique] = useState(4)
  const [donorCompanies, setDonorCompanies] = useState(12)
  const [donorSearched, setDonorSearched] = useState(5)
  const [exactTitleUnique, setExactTitleUnique] = useState(8)
  const [adjacentUnique, setAdjacentUnique] = useState(5)
  const [geoUnique, setGeoUnique] = useState(3)

  const metrics = useMemo(() => {
    const laneCoverage = ratio(Math.min(workedLanes, plannedLanes), plannedLanes)
    const duplicateRate = ratio(Math.min(alreadyKnown, recentSaved), recentSaved)
    const uniqueQueryYield = ratio(Math.min(archetypeUnique, archetypeLeads), archetypeLeads)
    const donorCoverage = ratio(Math.min(donorSearched, donorCompanies), donorCompanies)
    const adjacentYield = exactTitleUnique > 0 ? adjacentUnique / exactTitleUnique : null
    const newLeadRate = activeHours > 0 ? newLeads / activeHours : null

    const openQuestions: string[] = []
    if (laneCoverage != null && laneCoverage < 1) openQuestions.push(`${Math.max(0, plannedLanes - workedLanes)} planned search lane${Math.max(0, plannedLanes - workedLanes) === 1 ? '' : 's'} remain unworked.`)
    if (donorCoverage != null && donorCoverage < 1) openQuestions.push(`${Math.max(0, donorCompanies - donorSearched)} donor compan${Math.max(0, donorCompanies - donorSearched) === 1 ? 'y remains' : 'ies remain'} unsearched.`)
    if (uniqueQueryYield != null && uniqueQueryYield > 0) openQuestions.push('The materially different query archetype is still contributing net-new leads.')
    if (adjacentUnique > 0) openQuestions.push('Adjacent-title searching is still producing unique leads; review whether the requirement is narrower than the work.')
    if (geoUnique > 0) openQuestions.push('Geographic expansion produced unique leads; location policy may still be a meaningful lever.')
    if (duplicateRate != null && duplicateRate >= 0.5) openQuestions.push('Recent duplicate rate is elevated. Track whether it keeps rising across multiple sessions rather than relying on one sample.')
    if (newLeadRate != null && newLeadRate > 0) openQuestions.push('Recent active sourcing is still producing new leads per hour; compare this rate with the first sessions on the req.')
    if (!openQuestions.length) openQuestions.push('The inputs show no obvious open lane, but that is not a validated exhaustion verdict. Review whether the planned lane map itself is complete before escalating.')

    return { laneCoverage, duplicateRate, uniqueQueryYield, donorCoverage, adjacentYield, newLeadRate, openQuestions }
  }, [plannedLanes, workedLanes, recentSaved, alreadyKnown, newLeads, activeHours, archetypeLeads, archetypeUnique, donorCompanies, donorSearched, exactTitleUnique, adjacentUnique, geoUnique])

  return <div>
    <div className="preview-banner" style={{ marginBottom: 20 }}>
      <span className="pb-icon">◈</span>
      <span><strong>Method note:</strong> This calculator exposes coverage evidence. It does not use a validated universal exhaustion score and it does not decide whether a requisition should close, change, or escalate.</span>
    </div>

    <div className="grid two">
      <div className="card">
        <span className="kicker">Lane coverage</span>
        <NumericField label="Planned job-relevant lanes" value={plannedLanes} onChange={setPlannedLanes} help="Distinct lanes you deliberately planned for this req." />
        <NumericField label="Lanes worked to your cap" value={workedLanes} onChange={setWorkedLanes} help="Lanes you actually searched long enough to evaluate." />
      </div>

      <div className="card">
        <span className="kicker">Duplicate pressure</span>
        <NumericField label="Recent saved leads reviewed" value={recentSaved} onChange={setRecentSaved} help="Use a consistent recent window, such as the last 20 saves." />
        <NumericField label="Already known to your team / ATS" value={alreadyKnown} onChange={setAlreadyKnown} help="Known candidates or duplicates within that same window." />
      </div>

      <div className="card">
        <span className="kicker">Recent yield</span>
        <NumericField label="New leads from recent sessions" value={newLeads} onChange={setNewLeads} help="New-to-team leads over the sessions you are comparing." />
        <NumericField label="Active sourcing hours" value={activeHours} onChange={setActiveHours} help="Active search time for those same sessions." />
      </div>

      <div className="card">
        <span className="kicker">Query variation</span>
        <NumericField label="Leads saved from a materially different archetype" value={archetypeLeads} onChange={setArchetypeLeads} help="For example: evidence-based after title-heavy." />
        <NumericField label="Those leads that were net-new" value={archetypeUnique} onChange={setArchetypeUnique} help="Not already surfaced by earlier lanes." />
      </div>

      <div className="card">
        <span className="kicker">Donor-map coverage</span>
        <NumericField label="Validated donor companies on the map" value={donorCompanies} onChange={setDonorCompanies} help="Companies included for an evidence-backed reason." />
        <NumericField label="Donor companies actually searched" value={donorSearched} onChange={setDonorSearched} help="Count only companies you genuinely worked as lanes." />
      </div>

      <div className="card">
        <span className="kicker">Expansion yield</span>
        <NumericField label="Unique exact-title leads" value={exactTitleUnique} onChange={setExactTitleUnique} help="Useful net-new leads from the exact-title lane." />
        <NumericField label="Unique adjacent-title leads" value={adjacentUnique} onChange={setAdjacentUnique} help="Useful net-new leads from adjacent-title searching." />
        <NumericField label="Unique leads gained after geographic expansion" value={geoUnique} onChange={setGeoUnique} help="Use the same review standard before and after expansion." />
      </div>
    </div>

    <section style={{ marginTop: 30 }}>
      <h2>Your coverage evidence</h2>
      <div className="grid">
        <div className="card"><span className="kicker">Lane coverage</span><div className="big-number">{pct(metrics.laneCoverage)}</div><p className="muted">Worked planned lanes ÷ planned lanes</p></div>
        <div className="card"><span className="kicker">Duplicate rate</span><div className="big-number">{pct(metrics.duplicateRate)}</div><p className="muted">Already-known recent saves ÷ recent saves</p></div>
        <div className="card"><span className="kicker">Unique query yield</span><div className="big-number">{pct(metrics.uniqueQueryYield)}</div><p className="muted">Net-new leads ÷ leads from a different archetype</p></div>
        <div className="card"><span className="kicker">Donor-map coverage</span><div className="big-number">{pct(metrics.donorCoverage)}</div><p className="muted">Donor companies searched ÷ validated donor map</p></div>
        <div className="card"><span className="kicker">Adjacent-title yield ratio</span><div className="big-number">{metrics.adjacentYield == null ? '—' : metrics.adjacentYield.toFixed(2)}</div><p className="muted">Unique adjacent leads ÷ unique exact-title leads</p></div>
        <div className="card"><span className="kicker">Recent new-lead rate</span><div className="big-number">{metrics.newLeadRate == null ? '—' : metrics.newLeadRate.toFixed(1)}</div><p className="muted">New leads per active sourcing hour</p></div>
      </div>
    </section>

    <section className="article-callout" style={{ marginTop: 28 }}>
      <h2>Questions to take into calibration</h2>
      <ul>{metrics.openQuestions.map(item => <li key={item}>{item}</li>)}</ul>
    </section>

    <div className="cta"><strong>Open the next lane:</strong> <Link href="/tools/search-lane-expander/">Search Lane Expander</Link> · <Link href="/blog/search-exhaustion-framework/">Read the methodology</Link></div>
  </div>
}
