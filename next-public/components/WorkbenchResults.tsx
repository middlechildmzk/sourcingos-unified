'use client'
import { useState } from 'react'
import type { SourceResult } from '@/lib/source-types'

interface WorkbenchResultsProps {
  results: SourceResult[]
  projectId?: string
  onProfileSaved?: (candidateId: string) => void
}

const SOURCE_COLORS: Record<string, string> = {
  github: '#5df2a3', npm: '#f6c96b', pypi: '#6baff6', openalex: '#b07fff',
  huggingface: '#f5a623', crates: '#e8805a', stackoverflow: '#f68b28',
  rubygems: '#cc342d', npi: '#6dd2de', pubmed: '#5398be', default: 'var(--muted)',
}

export function WorkbenchResults({ results, projectId, onProfileSaved }: WorkbenchResultsProps) {
  const [saving, setSaving] = useState<Set<string>>(new Set())
  const [saved, setSaved] = useState<Map<string, string>>(new Map()) // resultId → candidateId
  const [notices, setNotices] = useState<Map<string, string>>(new Map())

  if (results.length === 0) return null

  async function saveProfile(result: SourceResult) {
    if (saving.has(result.id) || saved.has(result.id)) return
    setSaving(prev => new Set(prev).add(result.id))

    try {
      const res = await fetch('/api/workbench/save-source-profile', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ sourceResult: result, projectId }),
      })
      const json = await res.json()

      if (json.ok) {
        setSaved(prev => new Map(prev).set(result.id, json.candidateId))
        setNotices(prev => new Map(prev).set(result.id, json.note || 'Saved. Pending recruiter review.'))
        onProfileSaved?.(json.candidateId)
      } else {
        setNotices(prev => new Map(prev).set(result.id, `Error: ${json.error}`))
      }
    } catch {
      setNotices(prev => new Map(prev).set(result.id, 'Save failed — please try again.'))
    } finally {
      setSaving(prev => { const n = new Set(prev); n.delete(result.id); return n })
    }
  }

  return (
    <div className="wb-results">
      <div className="wb-results-header">
        <span className="wb-section-title">Source profile results</span>
        <span className="status-preview">{results.length} source profiles — unconfirmed</span>
      </div>

      <div className="preview-banner" style={{ marginBottom: '16px' }}>
        <span className="pb-icon">◈</span>
        <span>
          <strong>Research only.</strong> These are source profiles, not confirmed candidates.
          Contact signals are unverified. Open-to-work is a signal. Clearance mentions are unverified breadcrumbs.
          Save to Candidate Graph and review identity signals before outreach.
        </span>
      </div>

      <div className="result-cards">
        {results.map(result => {
          const color = SOURCE_COLORS[result.source] || SOURCE_COLORS.default
          const isSaved = saved.has(result.id)
          const isSaving = saving.has(result.id)
          const notice = notices.get(result.id)
          const candidateId = saved.get(result.id)

          return (
            <div className="result-card" key={result.id}>
              <div className="result-head">
                <div className="result-identity">
                  <span className="result-source-badge" style={{ background: `${color}18`, color, borderColor: `${color}40` }}>
                    {result.source}
                  </span>
                  <div>
                    <div className="result-name">{result.displayName}</div>
                    {result.headline && <div className="result-headline">{result.headline}</div>}
                  </div>
                </div>
                <div className="result-actions">
                  {isSaved ? (
                    <>
                      <span className="status-live">Saved</span>
                      {candidateId && (
                        <a className="btn ghost" href={`/app/candidate/${candidateId}`} style={{ fontSize: '12px', padding: '5px 12px' }}>
                          View 360 →
                        </a>
                      )}
                    </>
                  ) : (
                    <button
                      className="btn secondary"
                      onClick={() => saveProfile(result)}
                      disabled={isSaving}
                      style={{ fontSize: '12px', padding: '6px 14px' }}
                    >
                      {isSaving ? 'Saving…' : '+ Save source profile'}
                    </button>
                  )}
                </div>
              </div>

              {(result.location || result.organization) && (
                <div className="result-meta">
                  {result.organization && <span>{result.organization}</span>}
                  {result.location && <span>· {result.location}</span>}
                </div>
              )}

              {result.skills.length > 0 && (
                <div className="result-skills">
                  {result.skills.slice(0, 8).map(s => <span key={s} className="tag">{s}</span>)}
                </div>
              )}

              {result.evidence.length > 0 && (
                <div className="result-evidence">
                  {result.evidence.slice(0, 3).map(e => (
                    <div key={e.id} className="result-evidence-item">
                      <span className={`conf-${e.confidence}`}>{e.confidence}</span>
                      <span className="evidence-label">{e.label}</span>
                    </div>
                  ))}
                </div>
              )}

              {result.contactSignals.length > 0 && (
                <div className="result-contacts">
                  <span className="contact-unverified">⚠ Unverified</span>
                  {result.contactSignals.slice(0, 2).map((c, i) => (
                    <span key={i} className="result-contact-value">{c.value}</span>
                  ))}
                </div>
              )}

              {result.profileUrl && (
                <a className="kicker" href={result.profileUrl} target="_blank" rel="noreferrer noopener" style={{ marginTop: '8px', display: 'inline-block' }}>
                  Open source profile →
                </a>
              )}

              {notice && (
                <div className="muted" style={{ fontSize: '12px', marginTop: '8px', color: isSaved ? 'var(--green)' : 'var(--amber)' }}>
                  {notice}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
