'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { AddToRoleButton } from '@/components/AddToRoleButton'

type Candidate = {
  id: string
  canonicalName: string
  headline: string
  location?: string
  currentCompany?: string
  summary: string
  skills: string[]
  sourceProfileIds: string[]
  evidenceItemIds: string[]
  contactSignalIds: string[]
  openToWorkSignalIds: string[]
  mergeStatus: string
}

type Snapshot = {
  candidates: Candidate[]
  sourceProfiles: any[]
  evidenceItems: any[]
  contactSignals: any[]
  openToWorkSignals: any[]
  matchReviews: any[]
  importBatches: any[]
}

const sampleResume = `Jordan Rivera
Senior DevSecOps Engineer
Minneapolis, MN | jordan.rivera@example.com | https://github.com/jrivera-platform

Kubernetes, Terraform, AWS GovCloud, FedRAMP, NIST RMF, Python, Linux, security automation.
Built CI/CD controls for regulated cloud environments. Available for contract consulting. Resume updated May 2026.`

export function CandidateDbClient() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null)
  const [resumeText, setResumeText] = useState(sampleResume)
  const [csvText, setCsvText] = useState('name,title,company,location,email,skills\nTaylor Chen,Technical Sourcer,Acme AI,Remote,taylor@example.com,AI sourcing GitHub Boolean')
  const [status, setStatus] = useState('')

  async function load() {
    const res = await fetch('/api/candidate-db/list')
    const json = await res.json()
    setSnapshot(json)
  }
  useEffect(() => { load().catch(() => undefined) }, [])

  async function importResume() {
    setStatus('Importing resume text...')
    const res = await fetch('/api/candidate-db/import-resume', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text: resumeText, fileName: 'sample-resume.txt' }) })
    const json = await res.json()
    setStatus(json.ok ? `Imported ${json.candidate.canonicalName}` : json.error)
    await load()
  }

  async function importCsv() {
    setStatus('Importing CSV...')
    const res = await fetch('/api/candidate-db/import-csv', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ csv: csvText, fileName: 'sample-candidates.csv' }) })
    const json = await res.json()
    setStatus(json.ok ? `Imported ${json.recordsCreated} candidate record(s)` : json.error)
    await load()
  }

  async function normalizeCandidate() {
    const res = await fetch('/api/candidate-db/normalize', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text: resumeText, source: 'uploaded_resume' }) })
    const json = await res.json()
    setStatus(json.ok ? `Normalization found ${json.normalized.skills.length} skill(s), ${json.normalized.contacts.length} contact signal(s), and ${json.normalized.openToWorkSignals.length} open-to-work signal(s).` : json.error)
  }

  async function createMatchReview() {
    const ids = snapshot?.sourceProfiles.slice(0, 2).map(p => p.id) || []
    if (ids.length < 2) { setStatus('Import at least two source profiles before creating a match review.'); return }
    const res = await fetch('/api/candidate-db/match-review', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ sourceProfileIds: ids }) })
    const json = await res.json()
    setStatus(json.ok ? `Created match review with score ${json.review.score}/100` : json.error)
    await load()
  }

  async function decide(reviewId: string, decision: 'confirmed' | 'rejected') {
    const res = await fetch('/api/candidate-db/confirm-merge', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ reviewId, decision }) })
    const json = await res.json()
    setStatus(json.ok ? `${decision === 'confirmed' ? 'Confirmed match' : 'Kept profiles separate'}` : json.error)
    await load()
  }

  return <div className="interactive-tool">
    <div className="cta"><b>Candidate Intelligence workspace:</b> Source profiles remain separate, contact signals are unverified by default, and merges require recruiter confirmation. Add reviewed records to a role-specific queue rather than assigning a global fit score.</div>
    <div className="grid two">
      <div className="card">
        <span className="kicker">Resume import</span>
        <h3>Paste resume/profile text</h3>
        <textarea className="textarea big" value={resumeText} onChange={e => setResumeText(e.target.value)} />
        <div className="button-row"><button className="btn" onClick={importResume}>Import resume</button><button onClick={normalizeCandidate}>Normalize only</button></div>
      </div>
      <div className="card">
        <span className="kicker">CSV import</span>
        <h3>Paste candidate CSV</h3>
        <textarea className="textarea big" value={csvText} onChange={e => setCsvText(e.target.value)} />
        <button className="btn" onClick={importCsv}>Import CSV</button>
      </div>
    </div>
    {status ? <div className="cta">{status}</div> : null}
    <div className="grid">
      <div className="card"><span className="kicker">Candidates</span><div className="big-number">{snapshot?.candidates.length || 0}</div></div>
      <div className="card"><span className="kicker">Source profiles</span><div className="big-number">{snapshot?.sourceProfiles.length || 0}</div></div>
      <div className="card"><span className="kicker">Contact signals</span><div className="big-number">{snapshot?.contactSignals.length || 0}</div></div>
      <div className="card"><span className="kicker">Open-to-work signals</span><div className="big-number">{snapshot?.openToWorkSignals.length || 0}</div></div>
    </div>
    <section>
      <div className="button-row"><button className="btn secondary" onClick={createMatchReview}>Create match review from first two source profiles</button><Link className="btn ghost" href="/app/roles">Open role workspaces →</Link></div>
      <h2>Candidate records</h2>
      <div className="results">{snapshot?.candidates.map(c => <div className="result-card" key={c.id}>
        <div className="result-head"><span>{c.mergeStatus}</span><span>{c.sourceProfileIds.length} source(s)</span></div>
        <h3>{c.canonicalName}</h3>
        <p className="muted">{c.headline} {c.location ? `· ${c.location}` : ''}</p>
        <p>{c.summary}</p>
        <div className="chips">{c.skills.map(skill => <span className="tag" key={skill}>{skill}</span>)}</div>
        <div className="button-row" style={{ marginTop: 12 }}>
          <Link className="btn ghost" href={`/app/candidate/${c.id}`}>Candidate 360 →</Link>
          <AddToRoleButton candidate={{
            candidateId: c.id,
            name: c.canonicalName,
            headline: c.headline,
            company: c.currentCompany,
            location: c.location,
            source: 'candidate_database',
            contactStatus: c.contactSignalIds.length ? 'signals_found' : 'unknown',
            evidenceStatus: c.evidenceItemIds.length ? 'reviewed' : 'unreviewed',
            tags: c.skills,
          }} />
        </div>
      </div>)}</div>
    </section>
    <section>
      <h2>Merge review queue</h2>
      <div className="results">{snapshot?.matchReviews.map(r => <div className="result-card" key={r.id}><div className="result-head"><span>{r.decision}</span><span>{r.score}/100</span></div><h3>{r.proposedCanonicalName}</h3><ul>{r.reasons.map((reason: string) => <li key={reason}>{reason}</li>)}</ul>{r.conflicts.length ? <p className="muted">Conflicts: {r.conflicts.join('; ')}</p> : null}<div className="button-row"><button onClick={() => decide(r.id, 'confirmed')}>Confirm merge</button><button onClick={() => decide(r.id, 'rejected')}>Keep separate</button></div></div>)}</div>
    </section>
  </div>
}
