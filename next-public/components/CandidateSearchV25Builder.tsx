'use client'

import { useMemo, useState } from 'react'
import { ALL_SOURCE_LANES } from '@/data/search-expansions'
import { getSearchAssistSuggestions } from '@/lib/search-assist'

type Mode = 'natural' | 'structured'

interface StructuredState {
  titles: string
  mustHaveSkills: string
  keywords: string
  location: string
  clearance: string
  companies: string
  exclusions: string
}

const emptyStructured: StructuredState = {
  titles: '',
  mustHaveSkills: '',
  keywords: '',
  location: '',
  clearance: '',
  companies: '',
  exclusions: '',
}

const EXAMPLES = [
  'Find cleared DevSecOps engineers in Northern Virginia with Kubernetes, Terraform, AWS, and TS/SCI.',
  'Find Machine Learning Engineers with Python, PyTorch, Hugging Face, LLMs, and MLOps.',
  'Find Epic analysts with HL7, FHIR, and healthcare data experience.',
]

const TITLE_SKILL_HINTS: Record<string, string[]> = {
  'ml engineer': ['Python', 'PyTorch', 'TensorFlow', 'Hugging Face', 'MLOps'],
  'devsecops engineer': ['Kubernetes', 'Terraform', 'AWS', 'Docker', 'CI/CD'],
  'cybersecurity engineer': ['Splunk', 'SIEM', 'NIST RMF', 'CrowdStrike', 'Palo Alto'],
  'security analyst': ['Splunk', 'SIEM', 'Threat hunting', 'Incident response'],
  'epic': ['Epic', 'HL7', 'FHIR', 'EMR/EHR', 'Cerner'],
  'data scientist': ['Python', 'PyTorch', 'TensorFlow', 'LLM', 'MLOps'],
  'software engineer': ['Python', 'TypeScript', 'React', 'AWS', 'Git'],
  'kubernetes engineer': ['Kubernetes', 'Docker', 'Helm', 'Terraform', 'AWS'],
}

function splitTerms(value: string): string[] {
  return value.split(/[\n,]+/).map(v => v.trim()).filter(Boolean)
}

function composeStructured(state: StructuredState): string {
  const exclusions = splitTerms(state.exclusions).map(x => `-${x.replace(/^[-]+/, '')}`)
  return [
    state.titles,
    state.mustHaveSkills,
    state.keywords,
    state.location,
    state.clearance,
    state.companies,
    exclusions.join(' '),
  ].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim()
}

function labelForSource(value: string): string {
  const lane = ALL_SOURCE_LANES.find(l => l.name.toLowerCase() === value.toLowerCase())
  return lane?.name || value
}

function sendToComposer(query: string) {
  const composerButton = Array.from(document.querySelectorAll<HTMLButtonElement>('.wb-tab'))
    .find(button => button.textContent?.includes('Search Composer'))
  composerButton?.click()

  window.setTimeout(() => {
    const input = document.querySelector<HTMLInputElement>('.composer-input')
    if (!input) return
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set
    setter?.call(input, query)
    input.dispatchEvent(new Event('input', { bubbles: true }))
    input.focus()
  }, 80)
}

function Bucket({ label, items, empty }: { label: string; items: string[]; empty: string }) {
  return (
    <div className="jd-summary-item">
      <span className="jd-summary-label">{label}</span>
      <span>{items.length ? items.join(', ') : empty}</span>
    </div>
  )
}

export function CandidateSearchV25Builder() {
  const [mode, setMode] = useState<Mode>('natural')
  const [naturalQuery, setNaturalQuery] = useState('')
  const [structured, setStructured] = useState<StructuredState>(emptyStructured)

  const activeQuery = mode === 'natural' ? naturalQuery : composeStructured(structured)
  const assist = useMemo(() => getSearchAssistSuggestions(activeQuery), [activeQuery])
  const recognized = assist.recognized
  const suggestions = assist.suggestions

  const titles = recognized.filter(r => r.type === 'title').map(r => r.canonical)
  const skills = recognized.filter(r => r.type === 'skill' || r.type === 'tool' || r.type === 'certification').map(r => r.canonical)
  const locations = recognized.filter(r => r.type === 'location').map(r => r.canonical)
  const manualSafe = recognized.filter(r => r.type === 'clearance' || r.type === 'employment-signal').map(r => r.canonical)
  const reviewFilters = recognized.filter(r => ['title', 'seniority', 'location', 'company', 'industry'].includes(r.type)).map(r => r.canonical)
  const sourceLanes = suggestions.filter(s => s.kind === 'source-lane').map(s => labelForSource(s.value))

  const titleOnly = titles.length > 0 && skills.length === 0
  const titleSkillHints = titles.flatMap(t => TITLE_SKILL_HINTS[t.toLowerCase()] || [])
  const suggestedSkills = [
    ...titleSkillHints,
    ...suggestions.filter(s => s.kind === 'skill' || s.kind === 'tool').map(s => s.value),
  ].filter((v, i, arr) => arr.indexOf(v) === i).slice(0, 8)

  const strength = skills.length >= 3
    ? manualSafe.length > 0 ? 'Strong with caution' : 'Strong'
    : titles.length > 0 && (skills.length > 0 || locations.length > 0)
      ? 'Medium'
      : activeQuery.trim() ? 'Weak' : 'Not enough signal yet'

  const missing = [
    titles.length === 0 ? 'role/title' : '',
    skills.length < 2 ? '2–4 concrete skills/tools' : '',
    locations.length === 0 ? 'location or remote preference' : '',
  ].filter(Boolean)

  return (
    <section className="jd-summary" style={{ marginBottom: '18px' }}>
      <div className="jd-summary-head">Candidate Search V2.5 — NLP sourcing builder</div>
      <p className="muted" style={{ margin: '6px 0 12px', lineHeight: 1.6 }}>
        Titles help frame the search. <strong>Skills and tools drive public-source results.</strong>
        Clearance, open-to-work, and contact signals remain manual-safe and unverified.
      </p>

      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '12px' }}>
        <button className="composer-toggle-btn" onClick={() => setMode('natural')} style={{ borderColor: mode === 'natural' ? 'var(--teal)' : undefined }}>
          Natural Language
        </button>
        <button className="composer-toggle-btn" onClick={() => setMode('structured')} style={{ borderColor: mode === 'structured' ? 'var(--teal)' : undefined }}>
          Structured Builder
        </button>
      </div>

      {mode === 'natural' ? (
        <div className="wb-form-row full" style={{ marginBottom: '12px' }}>
          <label>Tell SourcingOS who you want to find</label>
          <textarea
            value={naturalQuery}
            onChange={e => setNaturalQuery(e.target.value)}
            placeholder="Find cleared DevSecOps engineers in Northern Virginia with Kubernetes, Terraform, AWS, and TS/SCI."
            style={{ minHeight: '86px' }}
          />
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '8px' }}>
            {EXAMPLES.map(example => (
              <button key={example} type="button" className="suggestion-tag" onClick={() => setNaturalQuery(example)}>
                Try: {example.slice(0, 48)}…
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="wb-form-grid" style={{ marginBottom: '12px' }}>
          {([
            ['titles', 'Titles', 'ML Engineer, DevSecOps Engineer'],
            ['mustHaveSkills', 'Must-have skills/tools', 'Python, PyTorch, Kubernetes'],
            ['keywords', 'Keywords', 'MLOps, model serving, platform'],
            ['location', 'Location / remote', 'Northern Virginia, Remote US'],
            ['clearance', 'Clearance / manual-safe', 'TS/SCI, Secret, Public Trust'],
            ['companies', 'Target companies / domains', 'OpenAI, Anthropic, GovCon'],
            ['exclusions', 'Exclusions', 'jobs, hiring, bootcamp'],
          ] as const).map(([key, label, placeholder]) => (
            <div key={key} className="wb-form-row">
              <label>{label}</label>
              <input
                type="text"
                value={structured[key]}
                placeholder={placeholder}
                onChange={e => setStructured(prev => ({ ...prev, [key]: e.target.value }))}
              />
            </div>
          ))}
        </div>
      )}

      {activeQuery.trim() && (
        <>
          <div className="jd-summary-grid" style={{ marginBottom: '12px' }}>
            <Bucket label="Role/title detected" items={titles} empty="Add a role or title" />
            <Bucket label="Skills/tools detected" items={skills} empty="Add concrete tools for stronger public-source results" />
            <Bucket label="Location detected" items={locations} empty="Optional review filter" />
            <Bucket label="Manual-safe constraints" items={manualSafe} empty="None detected" />
            <Bucket label="Recommended source lanes" items={sourceLanes.slice(0, 5)} empty="GitHub baseline until more signal is added" />
            <Bucket label="Missing for stronger search" items={missing} empty="Looks strong" />
          </div>

          <div className="jd-summary-grid" style={{ marginBottom: '12px' }}>
            <Bucket label="Live public source terms" items={skills.length ? skills : suggestedSkills.slice(0, 4)} empty="Add skills/tools" />
            <Bucket label="Review filters" items={reviewFilters} empty="None yet" />
            <Bucket label="Manual-safe only" items={manualSafe} empty="None" />
            <Bucket label="Search strength" items={[strength]} empty="Not enough signal yet" />
          </div>

          {titleOnly && (
            <div className="preview-banner" style={{ marginBottom: '12px', borderColor: 'rgba(246,201,107,.35)' }}>
              <span className="pb-icon">◈</span>
              <span>
                <strong>Title-only searches are usually weak on public sources.</strong>{' '}
                Add 2–4 concrete skills/tools.
              </span>
            </div>
          )}

          {suggestedSkills.length > 0 && (
            <div style={{ marginBottom: '12px' }}>
              <div className="composer-section-label">Suggested skill chips</div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '8px' }}>
                {suggestedSkills.map(skill => (
                  <button
                    key={skill}
                    type="button"
                    className="suggestion-tag"
                    onClick={() => mode === 'natural'
                      ? setNaturalQuery(q => q.includes(skill) ? q : `${q} ${skill}`.trim())
                      : setStructured(prev => ({ ...prev, mustHaveSkills: prev.mustHaveSkills.includes(skill) ? prev.mustHaveSkills : `${prev.mustHaveSkills}${prev.mustHaveSkills ? ', ' : ''}${skill}` }))}
                  >
                    + {skill}
                  </button>
                ))}
              </div>
            </div>
          )}

          <button type="button" className="btn" onClick={() => sendToComposer(activeQuery)}>
            Send to Search Composer →
          </button>
        </>
      )}
    </section>
  )
}
