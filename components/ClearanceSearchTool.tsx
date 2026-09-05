'use client'
import { useMemo, useState } from 'react'
import { trackClientEvent } from '@/lib/analytics'

// ─────────────────────────────────────────────────────────────────────────────
// Clearance Search Builder — deterministic, client-only. No AI, no API calls.
// Builds compliant Boolean + X-Ray strings for cleared/GovCon searches and is
// explicit about what public signals can and cannot tell you about clearance.
//
// Trust rules baked in:
//   • Clearance level/agency are NEVER pushed into public X-Ray queries
//     (you cannot verify clearance from the open web; doing so invites false
//     positives and OPSEC problems). Clearance terms stay in LIR/ClearanceJobs
//     lanes only, where self-attestation is the norm.
//   • Every output ends with a "verify directly" reminder.
// ─────────────────────────────────────────────────────────────────────────────

type Level = 'Secret' | 'Top Secret' | 'TS/SCI' | 'Public Trust' | 'Clearable (US citizen)'
type Poly = 'None' | 'CI Poly' | 'Full-Scope Poly'

const LEVEL_TERMS: Record<Level, string[]> = {
  'Secret': ['"Secret clearance"', '"active Secret"', '"DoD Secret"'],
  'Top Secret': ['"Top Secret"', '"TS clearance"', '"active Top Secret"'],
  'TS/SCI': ['"TS/SCI"', '"TS SCI"', '"Top Secret SCI"'],
  'Public Trust': ['"Public Trust"', '"MBI"', '"Tier 2"', '"Tier 4"'],
  'Clearable (US citizen)': ['"US Citizen"', '"clearance eligible"', '"clearable"', '"ability to obtain clearance"'],
}
const POLY_TERMS: Record<Poly, string[]> = {
  'None': [],
  'CI Poly': ['"CI poly"', '"counterintelligence polygraph"', '"CI polygraph"'],
  'Full-Scope Poly': ['"FS poly"', '"full scope polygraph"', '"lifestyle poly"'],
}
// Cert adjacency reused from the repo's 8140/8570 reality.
const CERT_PRESETS: Record<string, string[]> = {
  'DevSecOps / Cloud': ['Security+', 'CISSP', 'AWS', 'Terraform', 'Kubernetes'],
  'ISSO / RMF': ['Security+', 'CISSP', 'CAP', 'RMF', 'eMASS'],
  'Cyber / SOC': ['Security+', 'GIAC', 'CySA+', 'Splunk', 'SIEM'],
  'Network / Systems': ['Security+', 'CCNA', 'CCNP', 'RHCE'],
  'None': [],
}

function q(s: string) { return /\s|\//.test(s) && !s.startsWith('"') ? `"${s}"` : s }
function orGroup(xs: string[], max = 8) {
  const clean = [...new Set(xs.filter(Boolean))].slice(0, max)
  return clean.length > 1 ? `(${clean.join(' OR ')})` : (clean[0] || '')
}
function download(name: string, content: string) {
  const url = URL.createObjectURL(new Blob([content], { type: 'text/markdown' }))
  const a = document.createElement('a'); a.href = url; a.download = name; a.click(); URL.revokeObjectURL(url)
}

const EXCLUSIONS = ['student', 'instructor', 'professor', 'bootcamp', 'sales', '"help desk"', '"desktop support"']

export function ClearanceSearchTool() {
  const [title, setTitle] = useState('DevSecOps Engineer')
  const [level, setLevel] = useState<Level>('TS/SCI')
  const [poly, setPoly] = useState<Poly>('None')
  const [certGroup, setCertGroup] = useState<keyof typeof CERT_PRESETS>('DevSecOps / Cloud')
  const [location, setLocation] = useState('Fort Meade OR "Annapolis Junction" OR Columbia MD')

  const outputs = useMemo(() => {
    const titles = orGroup([q(title), ...titleAdjacents(title)])
    const clearance = orGroup([...LEVEL_TERMS[level], ...POLY_TERMS[poly]])
    const certs = orGroup(CERT_PRESETS[certGroup].map(q))
    const exclusions = EXCLUSIONS
    const loc = location.trim()

    // LIR / ClearanceJobs: clearance terms allowed — these are platforms where
    // candidates self-attest clearance. Location optional.
    const lir = [titles, clearance, certs].filter(Boolean).join(' AND ')
      + (loc ? ` AND (${loc})` : '')
      + ` NOT (${exclusions.join(' OR ')})`

    // ClearanceJobs keyword line (no site operator — used inside the platform)
    const cj = [titles, certs].filter(Boolean).join(' AND ')

    // Public X-Ray: NO clearance terms. You cannot verify clearance from the
    // open web; pushing "TS/SCI" into a site: query mostly surfaces job posts
    // and résumés that *claim* it. Skills + title + location only.
    const xray = `site:linkedin.com/in ${titles} ${certs}${loc ? ` (${loc})` : ''} -intitle:jobs -inurl:jobs`

    // GitHub lane: skills only, clearance never applies to code signal.
    const github = `site:github.com ${orGroup(CERT_PRESETS[certGroup].filter(c => !['Security+', 'CISSP', 'CAP', 'CCNA', 'CCNP'].includes(c)).map(q))} ${titles.includes('Engineer') ? '' : ''}`.trim()

    return {
      lir: { label: 'LinkedIn Recruiter (clearance OK — self-attested)', query: lir, note: 'Clearance terms allowed here; treat any match as candidate-stated, not verified.' },
      cj: { label: 'ClearanceJobs keyword line', query: cj, note: 'Run inside ClearanceJobs; the platform already scopes to cleared candidates.' },
      xray: { label: 'Public Google X-Ray (NO clearance terms)', query: xray, note: 'Clearance intentionally omitted — the open web cannot verify it and the term mostly returns job posts.' },
      github: { label: 'GitHub skill lane', query: github, note: 'Skill signal only. Clearance is never inferable from code.' },
    }
  }, [title, level, poly, certGroup, location])

  function copy(label: string, query: string) {
    navigator.clipboard?.writeText(query); trackClientEvent('copy_clearance_string', label)
  }

  return (
    <div className="interactive-tool">
      <div className="form-grid" style={{ display: 'grid', gap: '12px' }}>
        <div>
          <label>Role / title</label>
          <input className="input" value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. ISSO, Cloud Engineer, RMF Analyst" />
        </div>
        <div className="mode-row">
          {(Object.keys(LEVEL_TERMS) as Level[]).map(l => (
            <button key={l} className={l === level ? 'active' : ''} onClick={() => { setLevel(l); trackClientEvent('tool_mode', 'clearance:' + l) }}>{l}</button>
          ))}
        </div>
        <div className="mode-row">
          {(Object.keys(POLY_TERMS) as Poly[]).map(pp => (
            <button key={pp} className={pp === poly ? 'active' : ''} onClick={() => setPoly(pp)}>{pp}</button>
          ))}
        </div>
        <div className="mode-row">
          {(Object.keys(CERT_PRESETS) as Array<keyof typeof CERT_PRESETS>).map(c => (
            <button key={c} className={c === certGroup ? 'active' : ''} onClick={() => setCertGroup(c)}>{c}</button>
          ))}
        </div>
        <div>
          <label>Location / market (optional)</label>
          <input className="input" value={location} onChange={e => setLocation(e.target.value)} placeholder='e.g. "Fort Meade" OR Huntsville OR "San Antonio"' />
        </div>
      </div>

      <div className="results">
        {Object.entries(outputs).map(([key, o]) => (
          <div className="result-card" key={key}>
            <div className="result-head"><strong>{o.label}</strong></div>
            <pre>{o.query}</pre>
            <p className="muted" style={{ fontSize: '12px', margin: '4px 0 8px' }}>{o.note}</p>
            <div className="button-row">
              <button onClick={() => copy(o.label, o.query)}>Copy</button>
              {key === 'xray' && (
                <button onClick={() => { trackClientEvent('launch_xray', 'clearance'); window.open('https://www.google.com/search?q=' + encodeURIComponent(o.query), '_blank') }}>Open Google</button>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="cta" style={{ marginTop: '16px', fontSize: '13px' }}>
        <strong>Verify directly, every time.</strong> Clearance level, adjudication date, and poly
        status cannot be confirmed from public sources. Any clearance term a candidate lists is
        self-stated until you confirm it with them and the facility security officer. SourcingOS
        never represents an unverified clearance as a fact.
      </div>

      <button className="btn" style={{ marginTop: '12px' }} onClick={() => {
        trackClientEvent('download_source_pack', 'clearance')
        download('sourcingos-clearance-search-pack.md',
          `# Clearance Search Pack — ${title}\n\nLevel: ${level} · Poly: ${poly} · Cert focus: ${certGroup}\nLocation: ${location || '(none)'}\n\n` +
          Object.values(outputs).map(o => `## ${o.label}\n\n\`${o.query}\`\n\n_${o.note}_`).join('\n\n') +
          `\n\n---\n**Verify directly.** Clearance, poly, and adjudication date cannot be confirmed from public sources. Treat every clearance term as candidate-stated until confirmed with the candidate and the FSO. SourcingOS does not represent unverified clearance as fact.`)
      }}>Download clearance search pack</button>
    </div>
  )
}

// Lightweight, deterministic title adjacency — no external calls.
function titleAdjacents(title: string): string[] {
  const t = title.toLowerCase()
  if (t.includes('devsecops') || t.includes('platform')) return ['"Platform Engineer"', '"Cloud Engineer"', 'SRE']
  if (t.includes('isso') || t.includes('issm') || t.includes('rmf')) return ['ISSM', '"Information System Security Officer"', '"RMF Analyst"']
  if (t.includes('cyber') || t.includes('soc')) return ['"Cybersecurity Analyst"', '"SOC Analyst"', '"Security Engineer"']
  if (t.includes('network')) return ['"Network Engineer"', '"Systems Engineer"']
  if (t.includes('cloud')) return ['"Cloud Engineer"', '"DevOps Engineer"', '"Platform Engineer"']
  return []
}
