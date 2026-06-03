'use client'
import { useState } from 'react'
import Link from 'next/link'
import { FindContactButton } from '@/components/FindContactButton'
import type { SourceResult } from '@/lib/source-types'

export interface DrawerSavedState {
  candidateId: string
  projectAssociated: boolean
}

interface CandidateDrawerProps {
  result: SourceResult | null
  open: boolean
  publicMode: boolean
  projectId?: string
  saved?: DrawerSavedState | null
  onClose: () => void
  onSaved?: (candidateId: string, displayName: string, source: string) => void
}

const SOURCE_COLORS: Record<string, string> = {
  github: '#5df2a3', npm: '#f6c96b', pypi: '#6baff6', openalex: '#b07fff',
  huggingface: '#f5a623', crates: '#e8805a', stackoverflow: '#f68b28',
  rubygems: '#cc342d', npi: '#6dd2de', pubmed: '#5398be', default: 'var(--muted)',
}
const CONF_COLOR: Record<string, string> = { high: 'var(--green)', medium: 'var(--accent)', low: 'var(--muted)' }

const SOURCE_OPEN_LABEL: Record<string, string> = {
  github: 'Open GitHub', openalex: 'Open OpenAlex', npm: 'Open npm',
  pypi: 'Open PyPI', huggingface: 'Open Hugging Face', crates: 'Open crates.io',
  rubygems: 'Open RubyGems', stackoverflow: 'Open Stack Overflow',
}

export function CandidateDrawer({
  result, open, publicMode, projectId, saved, onClose, onSaved,
}: CandidateDrawerProps) {
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState('')
  const [authPrompt, setAuthPrompt] = useState(false)
  const [localSaved, setLocalSaved] = useState<DrawerSavedState | null>(saved ?? null)

  if (!result) return null

  const color = SOURCE_COLORS[result.source] || SOURCE_COLORS.default
  const openLabel = SOURCE_OPEN_LABEL[result.source] || 'Open source profile'
  const isSaved = Boolean(localSaved)

  async function saveSourceProfile() {
    if (!result) return
    // Gate in public mode
    if (publicMode) {
      setAuthPrompt(true)
      return
    }
    if (saving || isSaved) return
    setSaving(true); setNotice(''); setAuthPrompt(false)
    try {
      const res = await fetch('/api/workbench/save-source-profile', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ sourceResult: result, projectId }),
      })
      if (res.status === 401) { setAuthPrompt(true); return }
      const json = await res.json()
      if (json.ok) {
        const state = { candidateId: json.candidateId, projectAssociated: Boolean(projectId) }
        setLocalSaved(state)
        setNotice(json.note || 'Saved — pending recruiter review.')
        onSaved?.(json.candidateId, result.displayName, result.source)
      } else if (json.error === 'Authentication required.') {
        setAuthPrompt(true)
      } else {
        setNotice(`Error: ${json.error}`)
      }
    } catch {
      setNotice('Save failed — check your network connection.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className={`drawer-backdrop ${open ? 'drawer-backdrop-open' : ''}`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer panel */}
      <aside className={`candidate-drawer ${open ? 'candidate-drawer-open' : ''}`} role="dialog" aria-label="Candidate profile">
        <div className="drawer-header">
          <span className="result-source-badge" style={{ background: `${color}18`, color, borderColor: `${color}40` }}>
            {result.source}
          </span>
          <button className="drawer-close" onClick={onClose} aria-label="Close">×</button>
        </div>

        <div className="drawer-body">
          {/* Identity */}
          <div className="drawer-identity">
            <h2 className="drawer-name">{result.displayName}</h2>
            {result.headline && <p className="drawer-headline">{result.headline}</p>}
            <div className="drawer-meta">
              {result.organization && <span>{result.organization}</span>}
              {result.location && <span>· {result.location}</span>}
            </div>
          </div>

          {/* Compliance framing */}
          <div className="drawer-compliance">
            <span className="result-compliance-badge result-badge-public">Public evidence match</span>
            <span className="result-compliance-badge">Not a confirmed candidate</span>
            {result.location && <span className="result-compliance-badge">Location not verified</span>}
          </div>

          {/* Drawer-first framing: preview vs saved */}
          {isSaved ? (
            <div className="drawer-preview-note drawer-preview-saved">
              ✓ Saved to Candidate Graph. This is now a recruiter-confirmed record — open the full Candidate 360 for the deep-dive dossier.
            </div>
          ) : (
            <div className="drawer-preview-note drawer-preview-unsaved">
              This is a source profile preview. Review the evidence here, then save it to create a recruiter-confirmed Candidate 360 record. Saving is optional — you can keep reviewing without it.
            </div>
          )}

          {/* External source links */}
          {result.profileUrl && (
            <a className="btn secondary drawer-external" href={result.profileUrl} target="_blank" rel="noreferrer noopener">
              {openLabel} ↗
            </a>
          )}

          {/* Why matched / evidence */}
          {result.evidence.length > 0 && (
            <section className="drawer-section">
              <div className="drawer-section-title">Why matched — {result.evidence.length} evidence item{result.evidence.length !== 1 ? 's' : ''}</div>
              {result.evidence.map(e => (
                <div key={e.id} className="drawer-evidence">
                  <span className="result-evidence-conf" style={{ color: CONF_COLOR[e.confidence] || CONF_COLOR.medium }}>{e.confidence}</span>
                  <div style={{ minWidth: 0 }}>
                    <div className="drawer-evidence-label">{e.label}</div>
                    {e.detail && e.detail !== e.label && <div className="drawer-evidence-detail">{e.detail}</div>}
                    {e.url && <a className="kicker" href={e.url} target="_blank" rel="noreferrer noopener">View source →</a>}
                  </div>
                </div>
              ))}
            </section>
          )}

          {/* Matched skills */}
          {result.skills.length > 0 && (
            <section className="drawer-section">
              <div className="drawer-section-title">Matched skills & tools</div>
              <div className="result-skills">
                {result.skills.map(s => <span key={s} className="tag">{s}</span>)}
              </div>
            </section>
          )}

          {/* Contact signals */}
          <section className="drawer-section">
            <div className="drawer-section-title">Contact signals</div>
            {result.contactSignals.length > 0 ? (
              <>
                <div className="contact-unverified" style={{ marginBottom: '6px' }}>⚠ Unverified — does not imply permission to contact</div>
                {result.contactSignals.map((c, i) => (
                  <div key={i} className="drawer-contact-row">
                    <span className="drawer-contact-type">{c.type.replace('_', ' ')}</span>
                    <span className="result-contact-value">{c.value}</span>
                  </div>
                ))}
              </>
            ) : (
              <p className="muted" style={{ fontSize: '13px', margin: '0 0 8px' }}>No contact signal found yet</p>
            )}
            <FindContactButton
              isAuthenticated={!publicMode}
              source={{
                sourceProfileId: result.sourceProfileId,
                displayName: result.displayName,
                headline: result.headline,
                organization: result.organization,
                location: result.location,
                profileUrl: result.profileUrl,
                source: result.source,
              }}
            />
          </section>

          {/* Open-to-work — explicit honest framing */}
          <section className="drawer-section">
            <div className="drawer-section-title">Open-to-work signal</div>
            <p className="muted" style={{ fontSize: '13px', margin: 0 }}>
              No open-to-work signal detected. Open-to-work is a signal, never a verified claim —
              confirm intent directly with the candidate.
            </p>
          </section>

          {/* Verify next */}
          <section className="drawer-section">
            <div className="drawer-section-title">Verify next</div>
            <ul className="verify-list">
              <li>Confirm current title and employer from a primary source</li>
              <li>Do not treat contact info as verified — confirm before outreach</li>
              {result.location && <li>Confirm location and remote eligibility</li>}
              <li>Confirm identity before merging with any existing candidate</li>
            </ul>
          </section>
        </div>

        {/* Sticky action footer */}
        <div className="drawer-footer">
          {authPrompt && (
            <div className="find-contact-msg find-contact-auth" style={{ marginBottom: '8px' }}>
              Sign in to save this candidate and build your Candidate Graph.{' '}
              <Link href="/login" style={{ textDecoration: 'underline' }}>Sign in →</Link>
            </div>
          )}
          {notice && (
            <div className="muted" style={{ fontSize: '12px', marginBottom: '8px', color: isSaved ? 'var(--green)' : 'var(--amber)' }}>
              {notice}
            </div>
          )}

          {isSaved ? (
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <span className="status-live" style={{ alignSelf: 'center' }}>Saved</span>
              {localSaved && (
                <a className="btn secondary" href={`/app/candidate/${localSaved.candidateId}`} style={{ flex: 1, fontSize: '13px' }}>
                  View full Candidate 360 →
                </a>
              )}
            </div>
          ) : (
            <div style={{ display: 'flex', gap: '8px', flexDirection: 'column' }}>
              <button className="btn" style={{ flex: 1 }} onClick={saveSourceProfile} disabled={saving}>
                {saving ? 'Saving…' : publicMode ? 'Save (sign in)' : projectId ? '+ Save & add to project' : '+ Save source profile'}
              </button>
              <span className="muted" style={{ fontSize: '11px', textAlign: 'center' }}>
                Save to create a Candidate 360 record
              </span>
            </div>
          )}
          <p className="muted" style={{ fontSize: '11px', marginTop: '8px', textAlign: 'center' }}>
            Saving keeps this drawer open so you can continue reviewing.
          </p>
        </div>
      </aside>
    </>
  )
}
