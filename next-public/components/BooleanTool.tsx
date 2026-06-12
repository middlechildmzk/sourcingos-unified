'use client'
import { useMemo, useState } from 'react'
import { trackClientEvent } from '@/lib/analytics'
import { parseJobDescription } from '@/lib/jd-parser'
import { buildLanes, type Lane } from '@/lib/jd-boolean-lanes'

// ─────────────────────────────────────────────────────────────────────────────
// JD → Boolean search builder (flagship free tool).
// Deterministic, client-only. No AI, no API, no server route, no new deps.
// Paste a JD (or upload .txt/.md), review extracted signals, get three lanes
// with copy + launch buttons. Route /tools/boolean-generator stays stable.
// ─────────────────────────────────────────────────────────────────────────────

const SAMPLE_JD = `Senior DevSecOps Engineer (TS/SCI required)

Required qualifications:
- Active TS/SCI clearance
- 5+ years building CI/CD pipelines (GitLab CI, Jenkins)
- Strong Kubernetes and Terraform in production
- AWS GovCloud experience
- RMF / ATO process familiarity, NIST 800-53

Preferred:
- Security+ or CISSP
- Python automation
- FedRAMP experience

You are a passionate, detail-oriented team player who thrives in a fast-paced
environment. Excellent communication skills required. Responsible for collaborating
with stakeholders. Competitive salary and benefits.`

function Ext({ label, items }: { label: string; items: string[] }) {
  if (!items.length) return null
  return (
    <div style={{ marginBottom: 8 }}>
      <span className="kicker">{label}</span>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
        {items.map(i => <span key={i} style={{ fontSize: 12, padding: '2px 8px', border: '1px solid rgba(255,255,255,.15)', borderRadius: 6 }}>{i}</span>)}
      </div>
    </div>
  )
}

function LaneCard({ lane }: { lane: Lane }) {
  function copy(text: string, what: string) { navigator.clipboard?.writeText(text); trackClientEvent('copy_boolean', `${lane.id}:${what}`) }
  const g = (qy: string) => `https://www.google.com/search?q=${encodeURIComponent(qy)}`
  const b = (qy: string) => `https://www.bing.com/search?q=${encodeURIComponent(qy)}`
  const gh = (qy: string) => `https://github.com/search?q=${encodeURIComponent(qy)}&type=users`

  return (
    <div className="result-card">
      <div className="result-head"><strong>{lane.name}</strong></div>
      <p className="muted" style={{ fontSize: 13, margin: '2px 0 10px' }}>{lane.useCase}</p>

      <label style={{ fontSize: 12 }}>Boolean</label>
      <pre>{lane.boolean}</pre>
      <div className="button-row"><button onClick={() => copy(lane.boolean, 'boolean')}>Copy Boolean</button></div>

      <label style={{ fontSize: 12, marginTop: 10, display: 'block' }}>LinkedIn Recruiter</label>
      <pre>{lane.linkedin}</pre>
      <div className="button-row"><button onClick={() => copy(lane.linkedin, 'linkedin')}>Copy LIR</button></div>

      <label style={{ fontSize: 12, marginTop: 10, display: 'block' }}>Google X-Ray</label>
      <pre>{lane.googleXray}</pre>
      <div className="button-row">
        <button onClick={() => copy(lane.googleXray, 'google')}>Copy</button>
        <button onClick={() => { trackClientEvent('launch_xray', `google:${lane.id}`); window.open(g(lane.googleXray), '_blank') }}>Search Google</button>
        <button onClick={() => { trackClientEvent('launch_xray', `bing:${lane.id}`); window.open(b(lane.bingXray), '_blank') }}>Search Bing</button>
      </div>

      {lane.github && (
        <>
          <label style={{ fontSize: 12, marginTop: 10, display: 'block' }}>GitHub (skills only)</label>
          <pre>{lane.github}</pre>
          <div className="button-row">
            <button onClick={() => copy(lane.github!, 'github')}>Copy</button>
            <button onClick={() => { trackClientEvent('launch_github', lane.id); window.open(gh(lane.github!), '_blank') }}>Search GitHub</button>
          </div>
        </>
      )}

      <div className="grid two" style={{ marginTop: 12, gap: 12 }}>
        <div><span className="kicker">Included</span><ul style={{ fontSize: 13, margin: '4px 0', paddingLeft: 18 }}>{lane.included.map(i => <li key={i}>{i}</li>)}</ul></div>
        <div><span className="kicker">Intentionally removed</span><ul style={{ fontSize: 13, margin: '4px 0', paddingLeft: 18 }}>{lane.removed.map(i => <li key={i}>{i}</li>)}</ul></div>
      </div>
      <div style={{ marginTop: 8 }}>
        <span className="kicker">Verify with the hiring manager</span>
        <ul style={{ fontSize: 13, margin: '4px 0', paddingLeft: 18 }}>{lane.verify.map(i => <li key={i}>{i}</li>)}</ul>
      </div>
    </div>
  )
}

export function BooleanTool() {
  const [jd, setJd] = useState(SAMPLE_JD)
  const [titleOverride, setTitleOverride] = useState('')
  const [includeLocation, setIncludeLocation] = useState(true)
  const [treatAsCleared, setTreatAsCleared] = useState(true)
  const [fileNote, setFileNote] = useState('')

  const result = useMemo(() => {
    if (!jd.trim()) return null
    const parsed = parseJobDescription(jd)
    if (titleOverride.trim()) parsed.roleTitle = titleOverride.trim()
    const isCleared = treatAsCleared || parsed.clearance.length > 0
    const lanes = buildLanes(parsed, jd, { includeLocation, isCleared })
    return { parsed, ...lanes }
  }, [jd, titleOverride, includeLocation, treatAsCleared])

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const ok = /\.(txt|md|markdown)$/i.test(file.name)
    if (!ok) { setFileNote('Only .txt and .md files are supported. Paste the JD text instead.'); return }
    if (file.size > 200 * 1024) { setFileNote('File is too large (max 200KB). Paste the relevant section instead.'); return }
    const reader = new FileReader()
    reader.onload = () => { setJd(String(reader.result || '')); setFileNote(`Loaded ${file.name}`); trackClientEvent('jd_file_upload', file.name.split('.').pop() || '') }
    reader.onerror = () => setFileNote('Could not read that file. Paste the JD text instead.')
    reader.readAsText(file)
  }

  return (
    <div className="interactive-tool">
      <div className="eyebrow">Step 1 · Paste the JD</div>
      <textarea className="textarea" style={{ minHeight: 180 }} value={jd} onChange={e => setJd(e.target.value)}
        placeholder="Paste the full job description or a large text block here…" />
      <div className="button-row" style={{ marginTop: 8, alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
        <label className="btn ghost" style={{ cursor: 'pointer', fontSize: 13 }}>
          Upload .txt/.md
          <input type="file" accept=".txt,.md,.markdown,text/plain,text/markdown" onChange={onFile} style={{ display: 'none' }} />
        </label>
        {fileNote && <span className="muted" style={{ fontSize: 12 }}>{fileNote}</span>}
        <span className="muted" style={{ fontSize: 12 }}>PDF/docx support can come later — paste the text for now.</span>
      </div>

      <div className="form-grid" style={{ display: 'grid', gap: 12, gridTemplateColumns: '1fr 1fr', marginTop: 14 }}>
        <div><label>Role / title override (optional)</label><input className="input" value={titleOverride} onChange={e => setTitleOverride(e.target.value)} placeholder={result?.parsed.roleTitle || 'auto-detected'} /></div>
        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-end', paddingBottom: 4 }}>
          <label style={{ fontSize: 13 }}><input type="checkbox" checked={includeLocation} onChange={e => setIncludeLocation(e.target.checked)} /> Include location</label>
          <label style={{ fontSize: 13 }}><input type="checkbox" checked={treatAsCleared} onChange={e => setTreatAsCleared(e.target.checked)} /> Cleared / GovCon</label>
        </div>
      </div>

      {result && (
        <>
          <div className="eyebrow" style={{ marginTop: 22 }}>Step 2 · Search signal review</div>
          <div className="card">
            <Ext label="Likely role title" items={[result.parsed.roleTitle]} />
            <Ext label="Adjacent titles" items={result.parsed.relatedTitles} />
            <Ext label="Must-have skills" items={result.parsed.mustHaveSkills} />
            <Ext label="Nice-to-have skills" items={result.parsed.preferredSkills} />
            <Ext label="Tools / platforms" items={result.parsed.tools} />
            <Ext label="Clearance / citizenship" items={result.parsed.clearance} />
            <Ext label="Location" items={result.parsed.location ? [result.parsed.location] : []} />
            <Ext label="Seniority" items={result.parsed.seniority ? [result.parsed.seniority] : []} />
            <Ext label="Industries / domain" items={result.parsed.industries} />
            {result.detectedNoise.length > 0 && (
              <div style={{ marginTop: 10 }}>
                <span className="kicker">Ignored as noise (removed from search)</span>
                <p className="muted" style={{ fontSize: 12, marginTop: 4 }}>{result.detectedNoise.join(' · ')}</p>
              </div>
            )}
            {result.excludedFromXray.length > 0 && (
              <p className="muted" style={{ fontSize: 12, marginTop: 8 }}>
                <strong>Kept out of public X-Ray on purpose:</strong> {result.excludedFromXray.join(', ')} — the open web can&rsquo;t verify clearance, and the term mostly returns job posts.
              </p>
            )}
          </div>

          <div className="cta" style={{ fontSize: 13, marginTop: 12 }}>
            JD text often contains non-searchable language. This tool removes soft skills, internal
            phrasing, and over-specific requirements that usually hurt sourcing. Use <strong>Precision</strong>
            for a tight first cut, <strong>Balanced</strong> for your default first pass, and <strong>Expanded</strong>
            for market mapping. Verify clearance, licensing, location, comp, and must-have tradeoffs with the hiring team.
          </div>

          <div className="eyebrow" style={{ marginTop: 22 }}>Step 3 · Choose a lane, copy or launch</div>
          <div className="results">{result.lanes.map(l => <LaneCard key={l.id} lane={l} />)}</div>
        </>
      )}
    </div>
  )
}
