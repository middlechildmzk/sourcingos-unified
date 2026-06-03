'use client'
import { useState } from 'react'
import Link from 'next/link'
import { FindContactButton } from '@/components/FindContactButton'
import type { SourceResult } from '@/lib/source-types'

export interface SavedEntry { id: string; displayName: string; source: string }

interface ChipContext {
  hardTerms: string[]
  softFilters: { canonical: string; type: string }[]
  manualSafe: string[]
  hasClearance: boolean
  hasLocation: boolean
  isSkillLight: boolean
}

interface WorkbenchResultsProps {
  results: SourceResult[]
  noResultsSources?: string[]
  suggestions?: string[]
  searchedQuery?: string
  chipContext?: ChipContext | null
  projectId?: string
  publicMode?: boolean
  onProfileSaved?: (entry: SavedEntry) => void
  onRetryComposer?: () => void
  onOpenDrawer?: (result: SourceResult) => void
}

const SOURCE_COLORS: Record<string, string> = {
  github: '#5df2a3', npm: '#f6c96b', pypi: '#6baff6', openalex: '#b07fff',
  huggingface: '#f5a623', crates: '#e8805a', stackoverflow: '#f68b28',
  rubygems: '#cc342d', npi: '#6dd2de', pubmed: '#5398be', default: 'var(--muted)',
}
const CONF_COLOR: Record<string, string> = {
  high: 'var(--green)', medium: 'var(--accent)', low: 'var(--muted)',
}

export function WorkbenchResults({
  results, noResultsSources = [], suggestions = [], searchedQuery,
  chipContext, projectId, publicMode, onProfileSaved, onRetryComposer, onOpenDrawer,
}: WorkbenchResultsProps) {
  const [saving, setSaving] = useState<Set<string>>(new Set())
  const [saved, setSaved] = useState<Map<string, string>>(new Map())
  const [notices, setNotices] = useState<Map<string, string>>(new Map())
  const [authRequired, setAuthRequired] = useState(false)

  // ── No-results state — context-aware guidance ──────────────────────────────
  if (results.length === 0) {
    return (
      <div className="wb-no-results">
        <div className="wb-section-title" style={{ marginBottom: '12px' }}>No results found</div>

        {searchedQuery && (
          <p className="muted" style={{ fontSize: '13px', marginBottom: '10px' }}>
            Searched: <code style={{ background: 'rgba(255,255,255,.05)', padding: '2px 6px', borderRadius: '4px' }}>
              {searchedQuery}
            </code>
          </p>
        )}

        {/* Context-specific guidance */}
        {chipContext?.hasClearance && (
          <div className="preview-banner" style={{ marginBottom: '14px', borderColor: 'rgba(138,124,255,.35)' }}>
            <span className="pb-icon">◈</span>
            <span>
              <strong>Clearance terms stripped from public source queries.</strong>{' '}
              GitHub, npm, OpenAlex, and PyPI do not surface clearance data.
              The search above used only your technical skill terms.
              Verify clearance manually through approved channels.
              Use ClearanceJobs (manual-safe) for cleared talent searches.
            </span>
          </div>
        )}

        {chipContext?.isSkillLight && !chipContext?.hasClearance && (
          <div className="preview-banner" style={{ marginBottom: '14px', borderColor: 'rgba(246,201,107,.3)' }}>
            <span className="pb-icon">◈</span>
            <span>
              <strong>Try skill-first.</strong> Public sources respond better to specific technical skills
              than job titles. Add React, Python, Kubernetes, or another tool to your search.
            </span>
          </div>
        )}

        {chipContext?.hasLocation && !chipContext?.hasClearance && (
          <div className="preview-banner" style={{ marginBottom: '14px', borderColor: 'rgba(246,201,107,.3)' }}>
            <span className="pb-icon">◈</span>
            <span>
              <strong>Location data is sparse on public sources.</strong>{' '}
              Try searching skill-only, then use location as a manual review filter.
            </span>
          </div>
        )}

        {noResultsSources.length > 0 && (
          <p className="muted" style={{ fontSize: '13px', marginBottom: '12px' }}>
            Sources returning no results: {noResultsSources.join(', ')}
          </p>
        )}

        {suggestions.length > 0 && (
          <div className="card" style={{ marginTop: '4px', marginBottom: '16px' }}>
            <div className="kicker" style={{ marginBottom: '10px' }}>Suggestions</div>
            <ul style={{ padding: '0 0 0 16px', margin: 0 }}>
              {suggestions.map(s => (
                <li key={s} style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '6px', lineHeight: 1.55 }}>{s}</li>
              ))}
            </ul>
          </div>
        )}

        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '4px' }}>
          {onRetryComposer && (
            <button className="btn secondary" onClick={onRetryComposer}>
              ← Refine search
            </button>
          )}
          <Link className="btn secondary" href="/tools/xray-search">Open X-Ray Launcher →</Link>
          <Link className="btn ghost" href="/tools/boolean-generator">Build Boolean string →</Link>
        </div>
      </div>
    )
  }

  async function saveProfile(result: SourceResult) {
    if (saving.has(result.id) || saved.has(result.id)) return
    // Public demo mode — prompt sign-in instead of saving
    if (publicMode) { setAuthRequired(true); return }
    setSaving(prev => new Set(prev).add(result.id))
    setAuthRequired(false)

    try {
      const res = await fetch('/api/workbench/save-source-profile', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ sourceResult: result, projectId }),
      })

      if (res.status === 401) { setAuthRequired(true); return }

      const json = await res.json()
      if (json.ok) {
        setSaved(prev => new Map(prev).set(result.id, json.candidateId))
        setNotices(prev => new Map(prev).set(result.id, json.note || 'Saved — pending review.'))
        onProfileSaved?.({ id: json.candidateId, displayName: result.displayName, source: result.source })
      } else {
        if (json.error === 'Authentication required.' || res.status === 403) {
          setAuthRequired(true)
        } else {
          setNotices(prev => new Map(prev).set(result.id, `Error: ${json.error}`))
        }
      }
    } catch {
      setNotices(prev => new Map(prev).set(result.id, 'Save failed — check your network connection.'))
    } finally {
      setSaving(prev => { const n = new Set(prev); n.delete(result.id); return n })
    }
  }

  return (
    <div className="wb-results">
      <div className="wb-results-header">
        <span className="wb-section-title">Source profile results</span>
        <span className="status-preview">{results.length} profile{results.length !== 1 ? 's' : ''} — unconfirmed</span>
      </div>

      <div className="preview-banner" style={{ marginBottom: '16px' }}>
        <span className="pb-icon">◈</span>
        <span>
          <strong>Research only.</strong> These are technical public-source profiles, not confirmed candidates.
          Clearance is not verified. Location is not verified. Contact signals are unverified.
          Save and confirm identity manually before any outreach.
        </span>
      </div>

      {authRequired && (
        <div className="preview-banner" style={{ marginBottom: '16px', borderColor: 'rgba(246,201,107,.4)', background: 'rgba(246,201,107,.05)' }}>
          <span className="pb-icon">◈</span>
          <span>
            <strong>Sign in required</strong> to save source profiles.{' '}
            <Link href="/login" style={{ color: 'var(--amber)', textDecoration: 'underline' }}>Sign in →</Link>
          </span>
        </div>
      )}

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
                  <span className="result-source-badge"
                    style={{ background: `${color}18`, color, borderColor: `${color}40` }}>
                    {result.source}
                  </span>
                  <div>
                    <button
                      className="result-name result-name-btn"
                      onClick={() => onOpenDrawer?.(result)}
                      title="Open profile drawer"
                    >
                      {result.displayName}
                    </button>
                    {result.headline && <div className="result-headline">{result.headline}</div>}
                  </div>
                </div>
                <div className="result-actions">
                  <button
                    className="btn ghost"
                    onClick={() => onOpenDrawer?.(result)}
                    style={{ fontSize: '12px', padding: '5px 12px' }}
                  >
                    View details
                  </button>
                  {isSaved ? (
                    <>
                      <span className="status-live">Saved</span>
                      {candidateId && (
                        <a className="btn ghost" href={`/app/candidate/${candidateId}`}
                          style={{ fontSize: '12px', padding: '5px 12px' }}>View 360 →</a>
                      )}
                    </>
                  ) : (
                    <button className="btn secondary" onClick={() => saveProfile(result)}
                      disabled={isSaving} style={{ fontSize: '12px', padding: '6px 14px' }}>
                      {isSaving ? 'Saving…' : publicMode ? 'Save (sign in)' : '+ Save profile'}
                    </button>
                  )}
                </div>
              </div>

              {/* Meta */}
              {(result.location || result.organization) && (
                <div className="result-meta">
                  {result.organization && <span>{result.organization}</span>}
                  {result.location && <span>· {result.location}</span>}
                </div>
              )}

              {/* Compliance badges */}
              <div className="result-compliance-badges">
                {chipContext?.hasClearance && (
                  <span className="result-compliance-badge">Clearance not verified</span>
                )}
                {result.location && chipContext?.hasLocation && (
                  <span className="result-compliance-badge">Location not verified</span>
                )}
                <span className="result-compliance-badge result-badge-public">Public evidence match</span>
              </div>

              {/* Why matched — evidence-first */}
              {result.evidence.length > 0 && (
                <div className="result-why-matched">
                  <div className="result-section-label">Why matched</div>
                  {result.evidence.slice(0, 3).map(e => (
                    <div key={e.id} className="result-evidence-item">
                      <span className="result-evidence-conf"
                        style={{ color: CONF_COLOR[e.confidence] || CONF_COLOR.medium }}>
                        {e.confidence}
                      </span>
                      <span className="evidence-label">{e.label}</span>
                      {e.detail && e.detail !== e.label && (
                        <span className="result-evidence-detail">{e.detail}</span>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Skills */}
              {result.skills.length > 0 && (
                <div className="result-skills">
                  {result.skills.slice(0, 8).map(s => <span key={s} className="tag">{s}</span>)}
                  {result.skills.length > 8 && (
                    <span className="muted" style={{ fontSize: '11px' }}>+{result.skills.length - 8}</span>
                  )}
                </div>
              )}

              {/* Contact — always unverified */}
              {result.contactSignals.length > 0 ? (
                <div className="result-contacts">
                  <span className="contact-unverified">⚠ Unverified</span>
                  {result.contactSignals.slice(0, 2).map((c, i) => (
                    <span key={i} className="result-contact-value">{c.value}</span>
                  ))}
                </div>
              ) : (
                <div className="result-contacts">
                  <span className="muted" style={{ fontSize: '12px' }}>No contact signal found yet</span>
                </div>
              )}

              {/* Find contact — future-ready, gated (provider not configured yet) */}
              <div style={{ marginTop: '6px' }}>
                <FindContactButton
                  compact
                  source={{
                    candidateId: undefined,
                    sourceProfileId: result.sourceProfileId,
                    displayName: result.displayName,
                    headline: result.headline,
                    organization: result.organization,
                    location: result.location,
                    profileUrl: result.profileUrl,
                    source: result.source,
                  }}
                />
              </div>

              {/* Missing info */}
              {result.evidence.length > 0 && (!result.location || !result.organization) && (
                <div className="result-missing">
                  <span className="result-section-label" style={{ color: 'var(--muted)' }}>Missing</span>
                  {!result.location && <span className="result-missing-item">Location</span>}
                  {!result.organization && <span className="result-missing-item">Organization</span>}
                </div>
              )}

              {result.profileUrl && (
                <a className="kicker" href={result.profileUrl} target="_blank" rel="noreferrer noopener"
                  style={{ marginTop: '8px', display: 'inline-block' }}>
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
