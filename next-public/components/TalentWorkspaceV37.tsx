'use client'

import Link from 'next/link'
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import { AddToRoleButton } from '@/components/AddToRoleButton'
import { EMPTY_CANDIDATE_WORKSPACE_SNAPSHOT, normalizeCandidateWorkspaceSnapshot, type CandidateWorkspaceSnapshot } from '@/lib/candidate-workspace-normalization'

type TalentPerson = CandidateWorkspaceSnapshot['candidates'][number]

function words(value: string) { return value.replaceAll('_', ' ') }
function text(value: unknown, fallback = '') { return typeof value === 'string' && value.trim() ? value.trim() : fallback }

export function TalentWorkspaceV37({ initialQuery = '' }: { initialQuery?: string }) {
  const [snapshot, setSnapshot] = useState<CandidateWorkspaceSnapshot>(EMPTY_CANDIDATE_WORKSPACE_SNAPSHOT)
  const [input, setInput] = useState(initialQuery)
  const [applied, setApplied] = useState(initialQuery)
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState('Loading Talent…')
  const [selectedId, setSelectedId] = useState('')

  const load = useCallback(async (search = '', offset = 0) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ limit: '50', offset: String(offset) })
      if (search) params.set('q', search)
      const response = await fetch(`/api/candidate-db/list?${params.toString()}`, { headers: { accept: 'application/json' }, cache: 'no-store' })
      const json = await response.json().catch(() => ({}))
      if (!response.ok || !json.ok) throw new Error(text(json.error, 'Could not load Talent.'))
      const next = normalizeCandidateWorkspaceSnapshot(json)
      setSnapshot(next)
      const firstPerson = next.candidates.find(candidate => candidate.entityKind === 'person')
      setSelectedId(current => next.candidates.some(candidate => candidate.id === current) ? current : firstPerson?.id || '')
      setStatus(search ? `${next.counts.filteredCandidates.toLocaleString()} canonical people matched.` : next.persistence_mode === 'supabase' ? 'Candidate Graph connected.' : 'Preview records are temporary.')
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Could not load Talent.')
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { void load(initialQuery, 0) }, [initialQuery, load])

  const people = useMemo(() => snapshot.candidates.filter(candidate => candidate.entityKind === 'person'), [snapshot.candidates])
  const selected = people.find(candidate => candidate.id === selectedId) || people[0] || null

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return
      if (!people.length) return
      const index = Math.max(0, people.findIndex(person => person.id === selected?.id))
      if (event.key.toLowerCase() === 'j') { event.preventDefault(); setSelectedId(people[Math.min(people.length - 1, index + 1)].id) }
      if (event.key.toLowerCase() === 'k') { event.preventDefault(); setSelectedId(people[Math.max(0, index - 1)].id) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [people, selected?.id])

  function search(event: FormEvent) {
    event.preventDefault()
    const next = input.trim()
    setApplied(next)
    void load(next, 0)
  }

  return <div className="talent-workspace-v37">
    <header className="talent-v37-header">
      <div><span className="search-kicker">Talent</span><h1>Your canonical people library.</h1><p>Rediscover known people across source observations, evidence, skills, employment history, and allowed stored contact signals.</p></div>
      <div className="talent-v37-header-actions"><Link href="/app/identity-review">Identity review{snapshot.counts.pendingMatchReviews ? ` · ${snapshot.counts.pendingMatchReviews}` : ''}</Link><Link className="primary" href="/app/search">Find new people</Link></div>
    </header>

    <section className="talent-v37-metrics">
      <div><small>Canonical people</small><b>{snapshot.counts.candidates.toLocaleString()}</b></div><div><small>Source observations</small><b>{snapshot.counts.sourceProfiles.toLocaleString()}</b></div><div><small>Evidence</small><b>{snapshot.counts.evidenceItems.toLocaleString()}</b></div><div><small>Identity review</small><b>{snapshot.counts.pendingMatchReviews.toLocaleString()}</b></div>
    </section>

    <div className="talent-v37-grid">
      <main className="talent-v37-list-pane">
        <div className="talent-v37-toolbar">
          <form onSubmit={search}><input value={input} onChange={event => setInput(event.target.value)} placeholder="Search name, skill, company, email, profile URL…" /><button type="submit">Search</button></form>
          <div><span>{status}</span>{applied && <button onClick={() => { setInput(''); setApplied(''); void load('', 0) }}>Clear</button>}</div>
        </div>

        {loading && <div className="talent-v37-skeletons">{Array.from({ length: 7 }).map((_, index) => <div key={index}><i /><span /><b /></div>)}</div>}
        {!loading && <div className="talent-v37-people">{people.map((person, index) => <button type="button" className={selected?.id === person.id ? 'is-selected' : ''} key={person.id} onClick={() => setSelectedId(person.id)}>
          <span className="talent-v37-rank">{index + 1}</span>
          <span className="talent-v37-person-main"><span><strong>{person.canonicalName}</strong><em>{words(person.mergeStatus)}</em></span><small>{[person.headline || person.currentTitle, person.currentCompany, person.location].filter(Boolean).join(' · ') || 'Candidate profile'}</small>{person.summary && <p>{person.summary.slice(0, 150)}{person.summary.length > 150 ? '…' : ''}</p>}<span className="talent-v37-tags">{person.skills.slice(0, 5).map(skill => <i key={skill}>{skill}</i>)}</span></span>
          <span className="talent-v37-person-meta"><b>{person.sourceProfileIds.length} sources</b><small>{person.evidenceItemIds.length} evidence</small><small>{person.contactSignalIds.length ? 'Contact signal' : 'Contact unknown'}</small></span>
        </button>)}{!people.length && <div className="talent-v37-empty"><h3>{applied ? 'No canonical people matched.' : 'No people yet.'}</h3><p>{applied ? 'Try a broader name, skill, company, or professional profile URL.' : 'Save discoveries from Search or import authorized data from Sources.'}</p><Link href="/app/search">Search talent →</Link></div>}</div>}

        <footer className="talent-v37-pagination"><button disabled={loading || snapshot.page.offset === 0} onClick={() => void load(applied, Math.max(0, snapshot.page.offset - snapshot.page.limit))}>← Previous</button><span>{people.length ? `${snapshot.page.offset + 1}–${snapshot.page.offset + people.length}` : '0'} shown</span><button disabled={loading || !snapshot.page.hasMore} onClick={() => void load(applied, snapshot.page.offset + snapshot.page.limit)}>Next →</button></footer>
      </main>

      <aside className="talent-v37-inspector">
        {!selected ? <div className="talent-v37-inspector-empty"><span className="search-kicker">Person inspector</span><h3>Select a person</h3><p>Inspect canonical identity, source coverage, evidence, and role actions.</p></div> : <TalentInspector person={selected} />}
      </aside>
    </div>
  </div>
}

function TalentInspector({ person }: { person: TalentPerson }) {
  const employment = person.universe?.employmentObservations || []
  return <div className="talent-inspector-v37">
    <section className="talent-inspector-v37-identity"><span className="search-kicker">Canonical person</span><h2>{person.canonicalName}</h2><p>{[person.headline || person.currentTitle, person.currentCompany].filter(Boolean).join(' · ') || 'Candidate profile'}</p><small>{person.location || 'Location not evidenced'}</small></section>
    <section><div className="search-section-title"><span>Identity state</span><small>{words(person.mergeStatus)}</small></div><div className="talent-v37-identity-state"><b>{person.sourceProfileIds.length} source observation{person.sourceProfileIds.length === 1 ? '' : 's'}</b><span>Cross-source observations stay attached to this canonical person only under SourcingOS identity rules.</span></div></section>
    <section><div className="search-section-title"><span>Observed skills</span><small>{person.skills.length}</small></div>{person.skills.length ? <div className="talent-v37-skill-list">{person.skills.slice(0, 20).map(skill => <span key={skill}>{skill}</span>)}</div> : <p className="talent-v37-muted">No structured skills are attached yet.</p>}</section>
    <section><div className="search-section-title"><span>Evidence & contact</span><small>truth layers</small></div><div className="talent-v37-state-grid"><div><small>Evidence records</small><b>{person.evidenceItemIds.length}</b></div><div><small>Contact signals</small><b>{person.contactSignalIds.length}</b></div></div><p className="talent-v37-muted">Contact signals do not imply ownership verification, deliverability, or permission to contact.</p></section>
    <section><div className="search-section-title"><span>Employment observations</span><small>{employment.length}</small></div>{employment.length ? <div className="talent-v37-profile-links">{employment.slice(0, 6).map(item => item.sourceUrl ? <a href={item.sourceUrl} target="_blank" rel="noreferrer" key={item.observationId}>{item.companyName}{item.title ? ` · ${item.title}` : ''} ↗</a> : <span key={item.observationId}>{item.companyName}{item.title ? ` · ${item.title}` : ''}</span>)}</div> : <p className="talent-v37-muted">No normalized employment observations are attached yet.</p>}</section>
    <footer className="talent-inspector-v37-actions"><AddToRoleButton candidate={{ candidateId: person.id, name: person.canonicalName, headline: person.headline, company: person.currentCompany, location: person.location, source: 'candidate_database', contactStatus: person.contactSignalIds.length ? 'signals_found' : 'unknown', evidenceStatus: person.evidenceItemIds.length ? 'reviewed' : 'unreviewed', tags: person.skills }} /><Link href={`/app/candidate/${encodeURIComponent(person.id)}`}>Open Candidate 360</Link></footer>
  </div>
}
