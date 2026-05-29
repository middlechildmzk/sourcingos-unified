'use client'
import { useState } from 'react'
import Link from 'next/link'

type Tab = 'intake' | 'strategy' | 'discovery' | 'saved'

interface IntakeData {
  jobTitle: string
  jobDescription: string
  mustHaves: string
  niceToHaves: string
  location: string
  workType: string
  clearanceNeeds: string
  targetCompanies: string
  disqualifiers: string
  compensationNotes: string
  hiringManagerNotes: string
}

const defaultIntake: IntakeData = {
  jobTitle: '',
  jobDescription: '',
  mustHaves: '',
  niceToHaves: '',
  location: '',
  workType: 'any',
  clearanceNeeds: '',
  targetCompanies: '',
  disqualifiers: '',
  compensationNotes: '',
  hiringManagerNotes: '',
}

// Connector registry — status reflects actual implementation in source-connectors.ts
// live = real API call implemented; preview = API exists but fallback/partial;
// manual-safe = generates query, user runs manually; requires-key = needs env var
const CONNECTORS = [
  { id: 'github', name: 'GitHub', category: 'Technical', status: 'live', desc: 'Profile and contribution search' },
  { id: 'npm', name: 'npm', category: 'Technical', status: 'live', desc: 'Package author lookup' },
  { id: 'pypi', name: 'PyPI', category: 'Technical', status: 'live', desc: 'Python package author lookup' },
  { id: 'crates', name: 'crates.io', category: 'Technical', status: 'live', desc: 'Rust package author lookup' },
  { id: 'openalex', name: 'OpenAlex', category: 'Research', status: 'live', desc: 'Open academic publications' },
  { id: 'huggingface', name: 'Hugging Face', category: 'AI/ML', status: 'live', desc: 'Model and dataset authors' },
  { id: 'rubygems', name: 'RubyGems', category: 'Technical', status: 'live', desc: 'Ruby gem author lookup' },
  { id: 'stackoverflow', name: 'Stack Overflow', category: 'Technical', status: 'preview', desc: 'Q&A contribution signals' },
  { id: 'arxiv', name: 'arXiv', category: 'Research', status: 'preview', desc: 'Preprint paper search' },
  { id: 'pubmed', name: 'PubMed', category: 'Healthcare', status: 'preview', desc: 'Clinical publication search' },
  { id: 'orcid', name: 'ORCID', category: 'Research', status: 'preview', desc: 'Researcher ID registry' },
  { id: 'semantic_scholar', name: 'Semantic Scholar', category: 'Research', status: 'preview', desc: 'AI-indexed academic search' },
  { id: 'npi', name: 'NPI Registry', category: 'Healthcare', status: 'preview', desc: 'US healthcare provider data' },
  { id: 'devto', name: 'DEV.to', category: 'Technical', status: 'preview', desc: 'Developer articles and activity' },
  { id: 'dockerhub', name: 'Docker Hub', category: 'Technical', status: 'preview', desc: 'Container image authors' },
  { id: 'kaggle', name: 'Kaggle', category: 'AI/ML', status: 'manual-safe', desc: 'Generate query, review manually' },
  { id: 'resume_xray', name: 'Resume X-Ray', category: 'Open Web', status: 'manual-safe', desc: 'Google X-Ray query, run manually' },
] as const

const STATUS_LABEL: Record<string, string> = {
  live: 'Live',
  preview: 'Preview',
  planned: 'Planned',
  'manual-safe': 'Manual-safe',
  'requires-key': 'API key required',
}

const STATUS_CLASS: Record<string, string> = {
  live: 'status-live',
  preview: 'status-preview',
  planned: 'status-planned',
  'manual-safe': 'status-manual',
  'requires-key': 'status-key',
}

const STRATEGY_SECTIONS = [
  { id: 'summary', label: 'Role Summary' },
  { id: 'must', label: 'Must-Have Signals' },
  { id: 'nice', label: 'Nice-to-Have Signals' },
  { id: 'disqual', label: 'Disqualifiers' },
  { id: 'titles', label: 'Target Titles' },
  { id: 'adjacent', label: 'Adjacent Titles' },
  { id: 'companies', label: 'Target Companies' },
  { id: 'lanes', label: 'Search Lanes' },
  { id: 'boolean', label: 'Boolean Strings' },
  { id: 'xray', label: 'X-Ray Strings' },
  { id: 'scorecard', label: 'Candidate Scorecard' },
  { id: 'calibration', label: 'HM Calibration Questions' },
]

function IntakeTab({
  intake,
  onChange,
  onGenerate,
}: {
  intake: IntakeData
  onChange: (field: keyof IntakeData, value: string) => void
  onGenerate: () => void
}) {
  const ready = intake.jobTitle.trim().length > 0

  return (
    <div className="wb-section">
      <div className="wb-section-title">Role intake</div>
      <div className="wb-form-grid">
        <div className="wb-form-row full">
          <label>Job title *</label>
          <input
            type="text"
            value={intake.jobTitle}
            onChange={e => onChange('jobTitle', e.target.value)}
            placeholder="e.g. DevSecOps Engineer, Staff ML Engineer, Cleared Cyber Analyst"
          />
        </div>
        <div className="wb-form-row full">
          <label>Job description</label>
          <textarea
            value={intake.jobDescription}
            onChange={e => onChange('jobDescription', e.target.value)}
            placeholder="Paste the full JD. The strategy output uses this to extract signals."
            className="textarea"
          />
        </div>
        <div className="wb-form-row">
          <label>Must-haves</label>
          <textarea
            value={intake.mustHaves}
            onChange={e => onChange('mustHaves', e.target.value)}
            placeholder="Non-negotiable requirements — skills, experience, certs, clearance level"
          />
        </div>
        <div className="wb-form-row">
          <label>Nice-to-haves</label>
          <textarea
            value={intake.niceToHaves}
            onChange={e => onChange('niceToHaves', e.target.value)}
            placeholder="Bonus qualifications, preferred background, extra signal"
          />
        </div>
        <div className="wb-form-row">
          <label>Location</label>
          <input
            type="text"
            value={intake.location}
            onChange={e => onChange('location', e.target.value)}
            placeholder="e.g. Northern Virginia, Remote US, San Francisco Bay Area"
          />
        </div>
        <div className="wb-form-row">
          <label>Work type</label>
          <select value={intake.workType} onChange={e => onChange('workType', e.target.value)}>
            <option value="any">Any</option>
            <option value="remote">Remote</option>
            <option value="hybrid">Hybrid</option>
            <option value="onsite">Onsite</option>
          </select>
        </div>
        <div className="wb-form-row">
          <label>Clearance / security needs</label>
          <input
            type="text"
            value={intake.clearanceNeeds}
            onChange={e => onChange('clearanceNeeds', e.target.value)}
            placeholder="e.g. Active TS/SCI, TS clearable, no clearance required"
          />
        </div>
        <div className="wb-form-row">
          <label>Target / donor companies</label>
          <textarea
            value={intake.targetCompanies}
            onChange={e => onChange('targetCompanies', e.target.value)}
            placeholder="Companies where this talent concentrates. One per line or comma-separated."
          />
        </div>
        <div className="wb-form-row">
          <label>Disqualifiers</label>
          <textarea
            value={intake.disqualifiers}
            onChange={e => onChange('disqualifiers', e.target.value)}
            placeholder="Hard stops — what removes a candidate from consideration immediately"
          />
        </div>
        <div className="wb-form-row">
          <label>Compensation notes</label>
          <input
            type="text"
            value={intake.compensationNotes}
            onChange={e => onChange('compensationNotes', e.target.value)}
            placeholder="Budget range, equity structure, comp constraints"
          />
        </div>
        <div className="wb-form-row full">
          <label>Hiring manager notes</label>
          <textarea
            value={intake.hiringManagerNotes}
            onChange={e => onChange('hiringManagerNotes', e.target.value)}
            placeholder="What the HM said about the ideal candidate, team, or non-obvious requirements"
          />
        </div>
      </div>
      <button className="wb-generate" onClick={onGenerate} disabled={!ready}>
        {ready ? 'Generate search strategy →' : 'Enter a job title to continue'}
      </button>
    </div>
  )
}

function StrategyTab({ intake, generated }: { intake: IntakeData; generated: boolean }) {
  if (!generated) {
    return (
      <div className="wb-empty">
        <h3>No strategy generated yet</h3>
        <p>Complete Role Intake and click "Generate search strategy" to build your source pack.</p>
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
          <Link className="btn secondary" href="/waitlist">Request beta access</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="wb-section">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
        <div>
          <div className="wb-section-title">Search strategy for: {intake.jobTitle}</div>
          {intake.location && (
            <div className="muted" style={{ fontSize: '13px', marginTop: '2px' }}>
              {intake.location} · {intake.workType !== 'any' ? intake.workType : 'any work type'}
            </div>
          )}
        </div>
        <span className="wb-preview-label">⚡ Preview mode — AI output in beta</span>
      </div>

      <div className="preview-banner">
        <span className="pb-icon">◈</span>
        <span>
          <strong>Beta preview:</strong> AI-powered strategy generation is in private beta. The structure below shows
          what SourcingOS produces per role intake. To unlock AI output,{' '}
          <Link href="/waitlist" style={{ color: 'var(--amber)', textDecoration: 'underline' }}>request beta access</Link>.
          You can still run manual discovery in the Discovery tab now.
        </span>
      </div>

      <div className="strategy-grid">
        {STRATEGY_SECTIONS.map(s => (
          <div className="strategy-card" key={s.id}>
            <div className="sc-head">
              <h4>{s.label}</h4>
              <span className="wb-preview-label">preview</span>
            </div>
            <div className="sc-body">AI output unlocked in beta</div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: '24px' }}>
        <p className="muted" style={{ fontSize: '13px', marginBottom: '12px' }}>
          Want to start searching now? Use the Discovery tab to run open-web searches across live source connectors.
        </p>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <Link className="btn secondary" href={`/sources`}>Open full connector search</Link>
          <Link className="btn ghost" href="/tools/boolean-generator">Build Boolean strings</Link>
          <Link className="btn ghost" href="/tools/xray-search">Launch X-Ray searches</Link>
        </div>
      </div>
    </div>
  )
}

function DiscoveryTab({ intake }: { intake: IntakeData }) {
  const [query, setQuery] = useState(intake.jobTitle || '')

  const categories = Array.from(new Set(CONNECTORS.map(c => c.category)))

  return (
    <div className="wb-section">
      <div className="wb-section-title">Discovery — connected sources</div>

      <div className="preview-banner">
        <span className="pb-icon">◈</span>
        <span>
          <strong>Research only.</strong> Connector search surfaces public profile data for research purposes.
          Contact signals are unverified. Open-to-work status is a signal, not a claim.
          No scraping of restricted platforms.
        </span>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <div className="wb-section-title" style={{ marginBottom: '8px' }}>Search connected sources</div>
        <div className="wb-discovery-search">
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="e.g. DevSecOps Kubernetes Terraform"
          />
          <Link
            className="btn"
            href={`/sources${query ? `?q=${encodeURIComponent(query)}` : ''}`}
          >
            Open full search
          </Link>
        </div>
        <p className="muted" style={{ fontSize: '12px' }}>
          Full source search with identity match scoring, candidate graph save, and merge review lives at{' '}
          <Link href="/sources" style={{ color: 'var(--accent)' }}>Candidate Graph connector search</Link>.
        </p>
      </div>

      {categories.map(cat => {
        const catConnectors = CONNECTORS.filter(c => c.category === cat)
        return (
          <div key={cat} style={{ marginBottom: '20px' }}>
            <div className="wb-section-title" style={{ marginBottom: '10px', fontSize: '11px' }}>{cat}</div>
            <div className="connector-grid">
              {catConnectors.map(c => (
                <div className="connector-card" key={c.id}>
                  <div className="cc-head">
                    <span className="cc-name">{c.name}</span>
                    <span className={STATUS_CLASS[c.status] || 'status-planned'}>
                      {STATUS_LABEL[c.status] || c.status}
                    </span>
                  </div>
                  <div className="cc-desc">{c.desc}</div>
                </div>
              ))}
            </div>
          </div>
        )
      })}

      <div className="card" style={{ marginTop: '20px' }}>
        <span className="kicker">Status legend</span>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '10px' }}>
          <span className="status-live">Live — real API call</span>
          <span className="status-preview">Preview — partial or fallback</span>
          <span className="status-manual">Manual-safe — generates query, you run it</span>
          <span className="status-key">API key required</span>
        </div>
      </div>
    </div>
  )
}

function SavedTab() {
  return (
    <div className="wb-empty">
      <h3>No saved candidates yet</h3>
      <p>
        Run a discovery search, review source profiles, and save them to the Candidate Graph.
        Saved source profiles appear here for merge review and Candidate 360 build.
      </p>
      <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
        <Link className="btn secondary" href="/sources">Open source search</Link>
        <Link className="btn ghost" href="/app/candidate-database">View candidate database</Link>
      </div>
    </div>
  )
}

export function WorkbenchClient() {
  const [tab, setTab] = useState<Tab>('intake')
  const [intake, setIntake] = useState<IntakeData>(defaultIntake)
  const [strategyGenerated, setStrategyGenerated] = useState(false)

  const handleChange = (field: keyof IntakeData, value: string) => {
    setIntake(prev => ({ ...prev, [field]: value }))
  }

  const handleGenerate = () => {
    if (!intake.jobTitle.trim()) return
    setStrategyGenerated(true)
    setTab('strategy')
  }

  const TAB_LABELS: Record<Tab, string> = {
    intake: '01  Role Intake',
    strategy: '02  Search Strategy',
    discovery: '03  Discovery',
    saved: '04  Saved',
  }

  return (
    <div className="workbench">
      <div className="wb-tabs">
        {(['intake', 'strategy', 'discovery', 'saved'] as Tab[]).map(t => (
          <button
            key={t}
            className={`wb-tab ${tab === t ? 'active' : ''}`}
            onClick={() => setTab(t)}
          >
            {TAB_LABELS[t]}
          </button>
        ))}
      </div>
      <div className="wb-content">
        {tab === 'intake' && (
          <IntakeTab intake={intake} onChange={handleChange} onGenerate={handleGenerate} />
        )}
        {tab === 'strategy' && (
          <StrategyTab intake={intake} generated={strategyGenerated} />
        )}
        {tab === 'discovery' && <DiscoveryTab intake={intake} />}
        {tab === 'saved' && <SavedTab />}
      </div>
    </div>
  )
}
