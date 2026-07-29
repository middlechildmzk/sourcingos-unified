'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import {
  entityKindLabels,
  canPromoteToCandidate,
} from '@/lib/entity-classification'
import {
  sourceLabels,
  type ClassifiedSourceResult,
  type SourceResult,
} from '@/lib/source-types'

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

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean).slice(0, 2)
  return parts.map(part => part.charAt(0)).join('').toUpperCase() || '?'
}

function classified(result: SourceResult): ClassifiedSourceResult {
  return {
    ...result,
    entityKind: result.entityKind ?? 'unknown',
  }
}

export function WorkbenchResults({
  results,
  noResultsSources = [],
  suggestions = [],
  searchedQuery,
  chipContext,
  projectId,
  publicMode,
  onProfileSaved,
  onRetryComposer,
  onOpenDrawer,
}: WorkbenchResultsProps) {
  const [saving, setSaving] = useState<Set<string>>(new Set())
  const [sourceFilter, setSourceFilter] = useState<string>('all')
  const [contactFilter, setContactFilter] = useState<'all' | 'has' | 'none'>('all')
  const [sortBy, setSortBy] = useState<'default' | 'evidence' | 'source'>('default')
  const [keyword, setKeyword] = useState('')
  const [saved, setSaved] = useState<Map<string, string>>(new Map())
  const [notices, setNotices] = useState<Map<string, string>>(new Map())
  const [authRequired, setAuthRequired] = useState(false)

  const normalizedResults = useMemo(() => results.map(classified), [results])

  if (normalizedResults.length === 0) {
    return (
      <div className="wb-no-results">
        <div className="recruiter-results-heading">
          <div>
            <h2>No profiles found</h2>
            <p>{searchedQuery ? `Searched: ${searchedQuery}` : 'Try a broader title, skill, company, or location.'}</p>
          </div>
        </div>

        {(chipContext?.hasClearance || chipContext?.hasLocation || chipContext?.isSkillLight) && (
          <div className="recruiter-trust-note" style={{ marginTop: '12px' }}>
            <strong>Search tip:</strong>
            <span>
              Public sources work best with concrete skills and tools. Treat location and clearance as review filters, then verify them through approved channels.
            </span>
          </div>
        )}

        {noResultsSources.length > 0 && (
          <p className="muted" style={{ fontSize: '12px', margin: '12px 0 0' }}>
            No results from: {noResultsSources.join(', ')}
          </p>
        )}

        {suggestions.length > 0 && (
          <div className="market-map-block" style={{ marginTop: '12px' }}>
            <h4>Ways to broaden this search</h4>
            <ul>{suggestions.map(suggestion => <li key={suggestion}>{suggestion}</li>)}</ul>
          </div>
        )}

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '14px' }}>
          {onRetryComposer && <button className="btn secondary" onClick={onRetryComposer}>← Refine search</button>}
          <Link className="btn ghost" href="/tools/xray-search">Open X-Ray Launcher</Link>
        </div>
      </div>
    )
  }

  async function saveProfile(result: ClassifiedSourceResult) {
    if (!canPromoteToCandidate(result.entityKind)) {
      setNotices(previous => new Map(previous).set(
        result.id,
        `${entityKindLabels[result.entityKind]} records cannot be saved as candidates.`,
      ))
      return
    }
    if (saving.has(result.id) || saved.has(result.id)) return
    if (publicMode) { setAuthRequired(true); return }

    setSaving(previous => new Set(previous).add(result.id))
    setAuthRequired(false)

    try {
      const response = await fetch('/api/workbench/save-source-profile', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ sourceResult: result, projectId }),
      })

      if (response.status === 401) { setAuthRequired(true); return }

      const json = await response.json()
      if (json.ok) {
        setSaved(previous => new Map(previous).set(result.id, json.candidateId))
        setNotices(previous => new Map(previous).set(result.id, json.note || 'Saved. Pending recruiter review.'))
        onProfileSaved?.({ id: json.candidateId, displayName: result.displayName, source: result.source })
      } else if (json.error === 'Authentication required.' || response.status === 403) {
        setAuthRequired(true)
      } else {
        setNotices(previous => new Map(previous).set(result.id, `Error: ${json.error}`))
      }
    } catch {
      setNotices(previous => new Map(previous).set(result.id, 'Save failed. Check your network connection.'))
    } finally {
      setSaving(previous => {
        const next = new Set(previous)
        next.delete(result.id)
        return next
      })
    }
  }

  const availableSources = [...new Set(normalizedResults.map(result => result.source))]
  const normalizedKeyword = keyword.trim().toLowerCase()
  const filtered = normalizedResults.filter(result => {
    if (sourceFilter !== 'all' && result.source !== sourceFilter) return false
    if (contactFilter === 'has' && result.contactSignals.length === 0) return false
    if (contactFilter === 'none' && result.contactSignals.length > 0) return false
    if (normalizedKeyword) {
      const searchable = [
        result.displayName,
        result.headline,
        result.organization,
        result.location,
        entityKindLabels[result.entityKind],
        ...result.skills,
        ...result.evidence.map(item => `${item.label} ${item.detail}`),
      ].filter(Boolean).join(' ').toLowerCase()
      if (!searchable.includes(normalizedKeyword)) return false
    }
    return true
  })

  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === 'evidence') return b.evidence.length - a.evidence.length
    if (sortBy === 'source') return sourceLabels[a.source].localeCompare(sourceLabels[b.source])
    return 0
  })
  const people = sorted.filter(result => result.entityKind === 'person')
  const supporting = sorted.filter(result => result.entityKind !== 'person')

  return (
    <div className="wb-results recruiter-results">
      <div className="recruiter-results-heading">
        <div>
          <h2>{publicMode ? 'People from public sources' : 'Candidate leads'}</h2>
          <p>Candidate actions are limited to records classified as people. Other source subjects remain visible as supporting evidence or discovery lanes.</p>
        </div>
        <div className="recruiter-results-count">{people.length} people</div>
      </div>

      <div className="recruiter-results-toolbar">
        <input
          value={keyword}
          onChange={event => setKeyword(event.target.value)}
          placeholder="Filter by name, title, company, location, skill, or subject type"
          aria-label="Filter candidate results"
        />
        <select value={sourceFilter} onChange={event => setSourceFilter(event.target.value)} aria-label="Filter by source">
          <option value="all">All sources</option>
          {availableSources.map(source => <option key={source} value={source}>{sourceLabels[source]}</option>)}
        </select>
        <select value={contactFilter} onChange={event => setContactFilter(event.target.value as 'all' | 'has' | 'none')} aria-label="Filter by contact state">
          <option value="all">Any contact state</option>
          <option value="has">Has contact signal</option>
          <option value="none">No contact signal</option>
        </select>
        <select value={sortBy} onChange={event => setSortBy(event.target.value as 'default' | 'evidence' | 'source')} aria-label="Sort results">
          <option value="default">Default order</option>
          <option value="evidence">Most evidence</option>
          <option value="source">Source</option>
        </select>
      </div>

      <div className="recruiter-trust-note">
        <strong>Unconfirmed public profiles.</strong>
        <span>Verify identity, current role, location, clearance, contact accuracy, and permission before acting.</span>
      </div>

      {authRequired && (
        <div className="results-auth-note">
          Saving and Candidate 360 actions require private beta access. <Link href="/waitlist" style={{ textDecoration: 'underline' }}>Request access →</Link>
        </div>
      )}

      <div className="recruiter-result-list" aria-label="Candidate people">
        {people.map(result => {
          const isSaved = saved.has(result.id)
          const isSaving = saving.has(result.id)
          const notice = notices.get(result.id)
          const candidateId = saved.get(result.id)
          const topEvidence = result.evidence[0]
          const subtitle = [result.headline, result.organization].filter(Boolean).join(' at ')

          return (
            <article className="recruiter-result-row" key={result.id}>
              <button
                className="recruiter-row-open-surface"
                type="button"
                onClick={() => onOpenDrawer?.(result)}
                aria-label={`Open profile for ${result.displayName}`}
              />
              <div
                className="recruiter-avatar"
                style={result.avatarUrl ? { backgroundImage: `url(${result.avatarUrl})`, backgroundPosition: 'center', backgroundSize: 'cover' } : undefined}
                aria-hidden="true"
              >
                {!result.avatarUrl && initials(result.displayName)}
              </div>

              <div className="recruiter-result-main">
                <div className="recruiter-result-topline">
                  <span className="recruiter-result-name">{result.displayName}</span>
                  <span className="recruiter-source-label">{sourceLabels[result.source]}</span>
                </div>

                <div className="recruiter-result-subtitle">{subtitle || 'Public source profile'}</div>
                {(result.location || (!result.organization && result.headline)) && (
                  <div className="recruiter-result-location">
                    {[result.location, !result.organization ? result.headline : ''].filter(Boolean).join(' · ')}
                  </div>
                )}

                {topEvidence && (
                  <div className="recruiter-result-match">
                    <span className="recruiter-match-label">Matched</span>
                    <span>{topEvidence.label}{topEvidence.detail && topEvidence.detail !== topEvidence.label ? ` · ${topEvidence.detail}` : ''}</span>
                  </div>
                )}

                {result.skills.length > 0 && (
                  <div className="recruiter-result-skills">
                    {result.skills.slice(0, 5).map(skill => <span className="recruiter-skill" key={skill}>{skill}</span>)}
                    {result.skills.length > 5 && <span className="recruiter-skill">+{result.skills.length - 5}</span>}
                  </div>
                )}

                <div className="recruiter-result-stats">
                  <span>{result.evidence.length} evidence item{result.evidence.length === 1 ? '' : 's'}</span>
                  <span>{result.contactSignals.length ? `${result.contactSignals.length} contact signal${result.contactSignals.length === 1 ? '' : 's'}` : 'No contact signal'}</span>
                  <span>Identity unconfirmed</span>
                </div>
              </div>

              <div className="recruiter-result-actions">
                <button className="btn secondary recruiter-open-btn" onClick={() => onOpenDrawer?.(result)}>Open profile</button>
                {result.profileUrl && <a className="btn ghost" href={result.profileUrl} target="_blank" rel="noreferrer noopener">Source ↗</a>}
                {isSaved ? (
                  candidateId ? <a className="btn ghost" href={`/app/candidate/${candidateId}`}>Candidate 360 →</a> : <span className="status-live">Saved</span>
                ) : (
                  <button className="btn ghost" onClick={() => void saveProfile(result)} disabled={isSaving}>
                    {isSaving ? 'Saving…' : publicMode ? 'Save' : '+ Save'}
                  </button>
                )}
              </div>

              {notice && <div className="recruiter-result-notice" style={{ color: isSaved ? 'var(--green)' : 'var(--amber)' }}>{notice}</div>}
            </article>
          )
        })}
      </div>

      {people.length === 0 && (
        <div className="market-map-block">
          <h4>No person records match the current filters</h4>
          <div>Supporting artifacts and discovery lanes are separated below rather than presented as candidates.</div>
        </div>
      )}

      {supporting.length > 0 && (
        <details className="supporting-subjects-disclosure">
          <summary>Supporting source subjects ({supporting.length})</summary>
          <div className="supporting-subject-list">
            {supporting.map(result => (
              <article className="supporting-subject-row" key={result.id}>
                <div>
                  <div className="supporting-subject-topline">
                    <strong>{result.displayName}</strong>
                    <span>{entityKindLabels[result.entityKind]}</span>
                    <span>{sourceLabels[result.source]}</span>
                  </div>
                  <p>{result.headline || result.evidence[0]?.detail || 'Supporting public-source evidence.'}</p>
                </div>
                <div className="recruiter-result-actions">
                  <button className="btn ghost" onClick={() => onOpenDrawer?.(result)}>Review evidence</button>
                  {result.profileUrl && <a className="btn ghost" href={result.profileUrl} target="_blank" rel="noreferrer noopener">Open source ↗</a>}
                </div>
                {notices.get(result.id) && <div className="recruiter-result-notice">{notices.get(result.id)}</div>}
              </article>
            ))}
          </div>
        </details>
      )}

      {sorted.length === 0 && (
        <div className="market-map-block">
          <h4>No source subjects match the current filters</h4>
          <div>Clear the keyword or broaden the source and contact filters.</div>
        </div>
      )}
    </div>
  )
}
