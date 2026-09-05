'use client'

import { useEffect, useMemo, useState } from 'react'

type Fact = {
  id: string
  fact_type: string
  fact_key: string
  value: Record<string, unknown>
  confidence: 'low' | 'medium' | 'high'
  verification_status: string
  source: string
  source_url?: string | null
  observed_at: string
  artifact_id?: string | null
}

type DocumentLead = {
  id: string
  url: string
  host: string
  document_kind: string
  title?: string | null
  status: string
  identity_confidence?: string | null
  identity_reason?: string | null
  restricted_reason?: string | null
  artifact_id?: string | null
  discovered_at: string
}

type Task = {
  id: string
  task_kind: string
  agent_id: string
  priority: number
  status: string
  attempts: number
  max_attempts: number
  last_error?: string | null
}

type Payload = { ok: boolean; migrationPending?: boolean; note?: string; facts: Fact[]; documents: DocumentLead[]; tasks: Task[] }

function words(value: string) { return value.replaceAll('_', ' ') }
function valueText(value: Record<string, unknown>) {
  for (const key of ['text', 'name', 'url', 'title', 'company', 'school']) {
    const item = value?.[key]
    if (typeof item === 'string' && item.trim()) return item.trim()
  }
  return Object.entries(value || {}).filter(([, item]) => typeof item === 'string' || typeof item === 'number').slice(0, 4).map(([key, item]) => `${words(key)}: ${String(item)}`).join(' · ')
}
function statusClass(status: string) {
  if (['verified','corroborated','parsed_attached','complete'].includes(status)) return 'success'
  if (['needs_review','identity_review','restricted_metadata_only','failed'].includes(status)) return 'warning'
  return 'active'
}

export function CandidateEnrichmentV40_4({ candidateId }: { candidateId: string }) {
  const [payload, setPayload] = useState<Payload>({ ok: true, facts: [], documents: [], tasks: [] })
  const [note, setNote] = useState('Loading autonomous enrichment…')

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const response = await fetch(`/api/candidate-db/enrichment/${encodeURIComponent(candidateId)}`, { headers: { accept: 'application/json' }, cache: 'no-store' })
        const json = await response.json()
        if (!response.ok || !json?.ok) throw new Error(json?.error || 'Could not load autonomous enrichment.')
        if (!cancelled) {
          setPayload(json)
          setNote(json.note || '')
        }
      } catch (error) {
        if (!cancelled) setNote(error instanceof Error ? error.message : 'Could not load autonomous enrichment.')
      }
    })()
    return () => { cancelled = true }
  }, [candidateId])

  const groups = useMemo(() => {
    const map = new Map<string, Fact[]>()
    for (const fact of payload.facts || []) {
      const values = map.get(fact.fact_type) || []
      values.push(fact)
      map.set(fact.fact_type, values)
    }
    return [...map.entries()].sort((a, b) => b[1].length - a[1].length)
  }, [payload.facts])
  const activeTasks = (payload.tasks || []).filter(task => ['queued','running','needs_review'].includes(task.status))

  return <section className="product-panel">
    <div className="product-panel-head">
      <div><span className="kicker">Autonomous research · V40.4</span><h2>Talent intelligence enrichment</h2></div>
      <span>{payload.facts.length} fact{payload.facts.length === 1 ? '' : 's'} · {payload.documents.length} document lead{payload.documents.length === 1 ? '' : 's'}</span>
    </div>
    <div className="cta" style={{ marginBottom: 14 }}><b>Source-stated is not verified.</b> Resume/CV and public-web observations stay provenance-linked. Ambiguous identity or conflicting facts require review; unattended workers do not capture contact values or merge people.</div>

    {payload.migrationPending && <div className="cta" style={{ marginBottom: 14 }}><b>Migration pending.</b> V40.4 enrichment storage is not active in this environment.</div>}
    {note && !payload.facts.length && !payload.documents.length && <p className="muted">{note}</p>}

    {activeTasks.length > 0 && <div style={{ marginBottom: 16 }}>
      <span className="kicker">Agent work queue</span>
      <div className="chips" style={{ marginTop: 7 }}>
        {activeTasks.slice(0, 12).map(task => <span className="tag" key={task.id}>{words(task.task_kind)} · {task.agent_id} · {task.status}</span>)}
      </div>
    </div>}

    {payload.documents.length > 0 && <div style={{ marginBottom: 18 }}>
      <span className="kicker">Public Resume/CV + document research</span>
      <div className="product-list" style={{ marginTop: 8 }}>
        {payload.documents.slice(0, 12).map(document => <div className="product-row" key={document.id}>
          <div className="product-row-main">
            <div style={{ display: 'flex', gap: 7, alignItems: 'center', flexWrap: 'wrap' }}>
              <div className="product-row-title">{document.title || document.host || 'Public document'}</div>
              <span className={`status-pill ${statusClass(document.status)}`}>{words(document.status)}</span>
              {document.identity_confidence && <span className="status-pill">identity · {document.identity_confidence}</span>}
            </div>
            <div className="product-row-meta">{document.identity_reason || document.restricted_reason || `${words(document.document_kind)} discovered from the public web.`}</div>
          </div>
          <a className="btn ghost" href={document.url} target="_blank" rel="noreferrer noopener">Open source</a>
        </div>)}
      </div>
    </div>}

    {groups.length > 0 && <div>
      <span className="kicker">Structured source facts</span>
      <div className="product-list" style={{ marginTop: 8 }}>
        {groups.flatMap(([type, facts]) => facts.slice(0, 10).map(fact => <div className="product-row" key={fact.id}>
          <div className="product-row-main">
            <div style={{ display: 'flex', gap: 7, alignItems: 'center', flexWrap: 'wrap' }}>
              <div className="product-row-title">{words(type)}</div>
              <span className={`status-pill ${statusClass(fact.verification_status)}`}>{words(fact.verification_status)}</span>
              <span className="status-pill">{fact.confidence} confidence</span>
            </div>
            <div className="product-row-meta">{valueText(fact.value) || 'Structured observation'} · source: {fact.source}</div>
          </div>
          {fact.source_url && <a className="btn ghost" href={fact.source_url} target="_blank" rel="noreferrer noopener">Evidence</a>}
        </div>)))}
      </div>
    </div>}

    {!payload.migrationPending && !note && !payload.facts.length && !payload.documents.length && !activeTasks.length && <p className="muted">This profile has not been enriched by the V40.4 worker fleet yet.</p>}
  </section>
}
