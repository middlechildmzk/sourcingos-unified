'use client'
import { useState } from 'react'
import Link from 'next/link'
import { FindContactButton } from '@/components/FindContactButton'
import { DrawerCopilot } from '@/components/DrawerCopilot'
import { FeedbackButtons } from '@/components/FeedbackButtons'
import type { CopilotPlanInput } from '@/lib/ai/types'
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
  plan?: CopilotPlanInput
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
  result, open, publicMode, projectId, plan, saved, onClose, onSaved,
}: CandidateDrawerProps) {
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState('')
  const [authPrompt, setAuthPrompt] = useState(false)
  const [localSaved, setLocalSaved] = useState<DrawerSavedState | null>(saved ?? null)

  if (!result) return null

  const color = SOURCE_COLORS[result.source] || SOURCE_COLORS.default
  const openLabel = SOURCE_OPEN_LABEL[result.source] || 'Open source profile'
  const isSaved = Boolean(localSaved)
  const missingData = [
    !result.location ? 'Location' : '',
    !result.organization ? 'Current organization' : '',
    result.contactSignals.length === 0 ? 'Contact path' : '',
    'Current interest and availability',
    'Identity match against other source profiles',
  ].filter(Boolean)
  const publicFacts = [
    `Source: ${result.source}`,
    result.profileUrl ? `Source URL: ${result.profileUrl}` : '',
    result.headline ? `Headline: ${result.headline}` : '',
    result.organization ? `Organization shown publicly: ${result.organization}` : '',
    result.location ? `Location shown publicly: ${result.location}` : '',
  ].filter(Boolean)
  const publicSignals = [
    ...result.skills.slice(0, 8).map(skill => `Skill/tool signal: ${skill}`),
    ...result.evidence.slice(0, 5).map(e => `Evidence signal: ${e.label}`),
    ...result.contactSignals.slice(0, 3).map(c => `Contact signal from ${c.source}: ${c.type.replace('_', ' ')}`),
  ]

  async function saveSourceProfile() {
    if (!result) return
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
        setNotice(json.note || 'Saved source profile. Identity and fit still require recruiter review.')
        onSaved?.(json.candidateId, result.displayName, result.source)
      } else if (json.error === 'Authentication required.') {
        setAuthPrompt(true)
      } else {
        setNotice(`Error: ${json.error}`)
      }
    } catch {
      setNotice('Save failed. Check your network connection.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <div
        className={`drawer-backdrop ${open ? 'drawer-backdrop-open' : ''}`}
        onClick={onClose}
        aria-hidden="true"
      />

      <aside className={`candidate-drawer ${open ? 'candidate-drawer-open' : ''}`} role="dialog" aria-label="Candidate source profile">
        <div className="drawer-header">
          <span className="result-source-badge" style={{ background: `${color}18`, color, borderColor: `${color}40` }}>
            {result.source}
          </span>
          <button className="drawer-close" onClick={onClose} aria-label="Close">×</button>
        </div>

        <div className="drawer-body">
          <div className="drawer-identity">
            <h2 className="drawer-name">{result.displayName}</h2>
            {result.headline && <p className="drawer-headline">{result.headline}</p>}
            <div className="drawer-meta">
              {result.organization && <span>{result.organization}</span>}
              {result.location && <span>· {result.location}</span>}
            </div>
          </div>

          <div className="drawer-compliance">
            <span className="result-compliance-badge result-badge-public">Public evidence match</span>
            <span className="result-compliance-badge">Not a confirmed candidate</span>
            <span className="result-compliance-badge">Confidence = source relevance only</span>
            {result.location && <span className="result-compliance-badge">Location not verified</span>}
          </div>

          {isSaved ? (
            <div className="drawer-preview-note drawer-preview-saved">
              ✓ Saved as a source profile. This is still pending recruiter review, same-person confirmation, and Candidate 360 completion.
            </div>
          ) : (
            <div className="drawer-preview-note drawer-preview-unsaved">
              This is a source profile preview. Review the evidence, missing data, and assumptions before saving. Saving does not verify identity, clearance, employment, or contact accuracy.
            </div>
          )}

          {result.profileUrl && (
            <a className="btn secondary drawer-external" href={result.profileUrl} target="_blank" rel="noreferrer noopener">
              {openLabel} ↗
            </a>
          )}

          <section className="drawer-section">
            <div className="drawer-section-title">Public facts</div>
            <ul className="verify-list">
              {publicFacts.length ? publicFacts.map(fact => <li key={fact}>{fact}</li>) : <li>No public facts beyond the source result were returned.</li>}
            </ul>
          </section>

          <section className="drawer-section">
            <div className="drawer-section-title">Public signals</div>
            <ul className="verify-list">
              {publicSignals.length ? publicSignals.map(signal => <li key={signal}>{signal}</li>) : <li>No strong public signals were returned.</li>}
            </ul>
            <p className="muted" style={{ fontSize: '12px', marginTop: '8px' }}>
              Signals help prioritize review. They are not verification.
            </p>
          </section>

          <section className="drawer-section">
            <div className="drawer-section-title">Assumptions to avoid</div>
            <ul className="verify-list">
              <li>Do not assume this source profile is the same person as any other profile.</li>
              <li>Do not assume current employment, current location, or availability from public text.</li>
              <li>Do not treat clearance, open-to-work, or contact signals as verified claims.</li>
            </ul>
          </section>

          <section className="drawer-section">
            <div className="drawer-section-title">Missing data</div>
            <ul className="verify-list">
              {missingData.map(item => <li key={item}>{item}</li>)}
            </ul>
          </section>

          {result.evidence.length > 0 && (
            <section className="drawer-section">
              <div className="drawer-section-title">Evidence snippets</div>
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
              <p className="muted" style={{ fontSize: '12px', margin: '8px 0 0' }}>
                Evidence confidence describes source relevance only. It does not verify the person.
              </p>
            </section>
          )}

          {result.skills.length > 0 && (
            <section className="drawer-section">
              <div className="drawer-section-title">Matched skills and tools</div>
              <div className="result-skills">
                {result.skills.map(s => <span key={s} className="tag">{s}</span>)}
              </div>
            </section>
          )}

          <section className="drawer-section">
            <div className="drawer-section-title">Contact signals</div>
            {result.contactSignals.length > 0 ? (
              <>
                <div className="contact-unverified" style={{ marginBottom: '6px' }}>⚠ Unverified. Does not imply permission to contact.</div>
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

          <section className="drawer-section">
            <div className="drawer-section-title">Open-to-work signal</div>
            <p className="muted" style={{ fontSize: '13px', margin: 0 }}>
              No open-to-work signal detected. Open-to-work is a signal, never a verified claim. Confirm intent directly with the candidate.
            </p>
          </section>

          <section className="drawer-section">
            <div className="drawer-section-title">Verify-next checklist</div>
            <ul className="verify-list">
              <li>Confirm current title and employer from a primary source.</li>
              <li>Confirm identity before merging with any existing candidate record.</li>
              <li>Confirm location, work authorization, remote eligibility, and compensation fit.</li>
              <li>Confirm clearance or license status only through the appropriate authorized process.</li>
              <li>Confirm contact path and outreach permission norms before outreach.</li>
            </ul>
          </section>

          <section className="drawer-section">
            <div className="drawer-section-title">Safe outreach angle draft</div>
            <p className="muted" style={{ fontSize: '13px', margin: 0 }}>
              Mention one specific public evidence item, ask a low-pressure relevance question, and avoid claims about current status, clearance, availability, or intent until confirmed.
            </p>
          </section>

          <section className="drawer-section">
            <FeedbackButtons
              projectId={projectId}
              sourceProfileId={result.sourceProfileId}
              searchQuery={plan?.rawQuery}
              matchedSkills={result.skills}
              source={result.source}
              title={result.headline}
            />
          </section>

          <DrawerCopilot
            publicMode={publicMode}
            candidate={{
              displayName: result.displayName,
              headline: result.headline,
              source: result.source,
              organization: result.organization,
              location: result.location,
              profileUrl: result.profileUrl,
              matchedSkills: result.skills,
              evidenceSnippets: result.evidence.map(e => e.label),
              contactSignalCount: result.contactSignals.length,
            }}
            plan={plan || {}}
          />
        </div>

        <div className="drawer-footer">
          {authPrompt && (
            <div className="find-contact-msg find-contact-auth" style={{ marginBottom: '8px' }}>
              This is available in the private beta. Request access to save evidence, build projects, and create Candidate 360 dossiers.{' '}
              <Link href="/waitlist" style={{ textDecoration: 'underline' }}>Request access →</Link>
            </div>
          )}
          {notice && (
            <div className="muted" style={{ fontSize: '12px', marginBottom: '8px', color: isSaved ? 'var(--green)' : 'var(--amber)' }}>
              {notice}
            </div>
          )}

          {isSaved ? (
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <span className="status-live" style={{ alignSelf: 'center' }}>Saved source profile</span>
              {localSaved && (
                <a className="btn secondary" href={`/app/candidate/${localSaved.candidateId}`} style={{ flex: 1, fontSize: '13px' }}>
                  Continue Candidate 360 →
                </a>
              )}
            </div>
          ) : (
            <div style={{ display: 'flex', gap: '8px', flexDirection: 'column' }}>
              <button className="btn" style={{ flex: 1 }} onClick={saveSourceProfile} disabled={saving}>
                {saving ? 'Saving…' : publicMode ? 'Save source profile (beta)' : projectId ? '+ Save and add to project' : '+ Save source profile'}
              </button>
              <span className="muted" style={{ fontSize: '11px', textAlign: 'center' }}>
                Saving creates a source profile record. Candidate 360 still requires recruiter confirmation.
              </span>
            </div>
          )}
          <p className="muted" style={{ fontSize: '11px', marginTop: '8px', textAlign: 'center' }}>
            Saving keeps this drawer open so you can continue reviewing evidence.
          </p>
        </div>
      </aside>
    </>
  )
}
