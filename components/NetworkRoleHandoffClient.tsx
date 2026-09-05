'use client'

import { useEffect, useState } from 'react'
import { AddToRoleButton } from '@/components/AddToRoleButton'
import type { NetworkRow } from '@/app/api/network/list/route'

type NetworkResponse = {
  response: Response
  rows: NetworkRow[]
  total: number
}

async function requestNetwork(searchQuery: string): Promise<NetworkResponse> {
  const trimmed = searchQuery.trim()
  const url = trimmed ? `/api/network/list?q=${encodeURIComponent(trimmed)}` : '/api/network/list'
  const response = await fetch(url, { headers: { accept: 'application/json' } })
  const json = await response.json()
  if (!response.ok || !json.ok) {
    const error = new Error(json.error || 'Network search failed.') as Error & { status?: number }
    error.status = response.status
    throw error
  }
  return {
    response,
    rows: Array.isArray(json.rows) ? json.rows.slice(0, 12) : [],
    total: Array.isArray(json.rows) ? json.rows.length : 0,
  }
}

export function NetworkRoleHandoffClient() {
  const [query, setQuery] = useState('')
  const [rows, setRows] = useState<NetworkRow[]>([])
  const [state, setState] = useState<'idle' | 'loading' | 'ready' | 'auth' | 'error'>('idle')
  const [message, setMessage] = useState('Search imported connections and add selected people to a role review queue.')

  async function runSearch(searchQuery: string) {
    setState('loading')
    try {
      const result = await requestNetwork(searchQuery)
      setRows(result.rows)
      setState('ready')
      setMessage(result.total
        ? `Showing ${Math.min(result.total, 12)} relationship-context result${result.total === 1 ? '' : 's'}. Review before adding.`
        : 'No imported connections matched this search.')
    } catch (error) {
      const status = (error as Error & { status?: number }).status
      setState(status === 401 ? 'auth' : 'error')
      setRows([])
      setMessage(status === 401 ? 'Sign in to search your private network.' : error instanceof Error ? error.message : 'Network search failed.')
    }
  }

  useEffect(() => {
    let active = true
    requestNetwork('')
      .then(result => {
        if (!active) return
        setRows(result.rows)
        setState('ready')
        setMessage(result.total
          ? `Showing ${Math.min(result.total, 12)} relationship-context result${result.total === 1 ? '' : 's'}. Review before adding.`
          : 'No imported connections matched this search.')
      })
      .catch(error => {
        if (!active) return
        const status = (error as Error & { status?: number }).status
        setState(status === 401 ? 'auth' : 'error')
        setRows([])
        setMessage(status === 401 ? 'Sign in to search your private network.' : error instanceof Error ? error.message : 'Network search failed.')
      })
    return () => { active = false }
  }, [])

  return (
    <section className="card" style={{ marginBottom: 18, padding: 16 }}>
      <div className="kicker">Warm network handoff</div>
      <h2 style={{ margin: '5px 0 7px', fontSize: 18 }}>Add known connections to a role</h2>
      <p className="muted" style={{ margin: '0 0 12px', fontSize: 13, lineHeight: 1.55 }}>{message}</p>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        <input
          value={query}
          onChange={event => setQuery(event.target.value)}
          onKeyDown={event => { if (event.key === 'Enter') runSearch(query) }}
          placeholder="Search network by name, title, or company"
          style={{ flex: '1 1 320px' }}
        />
        <button type="button" className="btn secondary" onClick={() => runSearch(query)} disabled={state === 'loading'}>
          {state === 'loading' ? 'Searching…' : 'Search network'}
        </button>
      </div>
      {rows.length > 0 && (
        <div style={{ display: 'grid', gap: 8 }}>
          {rows.map(row => (
            <div key={row.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', border: '1px solid var(--line)', borderRadius: 9, padding: '10px 12px', flexWrap: 'wrap' }}>
              <div style={{ minWidth: 220, flex: '1 1 360px' }}>
                <div style={{ fontWeight: 650 }}>{row.name}</div>
                <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
                  {[row.title, row.company, row.location].filter(Boolean).join(' · ') || 'Imported relationship context'}
                </div>
                <div style={{ display: 'flex', gap: 7, marginTop: 5, flexWrap: 'wrap', fontSize: 11, color: 'var(--muted)' }}>
                  <span>Relationship context</span>
                  {row.email && <span>Email signal unverified</span>}
                  {row.linkedinUrl && <a href={row.linkedinUrl} target="_blank" rel="noreferrer" style={{ color: 'var(--cyan)' }}>Open LinkedIn ↗</a>}
                </div>
              </div>
              <AddToRoleButton candidate={{
                candidateId: row.candidateId || undefined,
                name: row.name,
                headline: row.title,
                company: row.company,
                location: row.location,
                source: 'linkedin_network_import',
                sourceUrl: row.linkedinUrl || undefined,
                contactStatus: row.email ? 'signals_found' : 'unknown',
                evidenceStatus: 'unreviewed',
                tags: ['warm network'],
              }} />
            </div>
          ))}
        </div>
      )}
      <div style={{ marginTop: 10, fontSize: 11, color: 'var(--muted)', lineHeight: 1.5 }}>
        Adding a connection creates an unreviewed role candidate only. It does not imply job interest, qualification, outreach permission, or confirmed identity across sources.
      </div>
    </section>
  )
}
