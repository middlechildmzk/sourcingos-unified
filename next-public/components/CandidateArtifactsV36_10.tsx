'use client'

import { useEffect, useState } from 'react'

type Artifact = {
  id: string
  artifactType: string
  dataOrigin: string
  fileName?: string
  mimeType?: string
  sourceUrl?: string
  contentSha256: string
  extractionVersion: string
  rawTextLength: number
  identityAnchors?: {
    observedEmails?: string[]
    professionalProfiles?: Array<{ network?: string; canonicalUrl?: string; observedUrl?: string }>
  }
  observedAt?: string
}

function words(value: string) { return value.replaceAll('_', ' ') }

export function CandidateArtifactsV36_10({ candidateId }: { candidateId: string }) {
  const [artifacts, setArtifacts] = useState<Artifact[]>([])
  const [note, setNote] = useState('Loading candidate artifacts…')
  const [migrationPending, setMigrationPending] = useState(false)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const response = await fetch(`/api/candidate-db/artifacts/${encodeURIComponent(candidateId)}`, { headers: { accept: 'application/json' } })
        const json = await response.json()
        if (!response.ok || !json?.ok) throw new Error(json?.error || 'Could not load candidate artifacts.')
        if (!cancelled) {
          setArtifacts(Array.isArray(json.artifacts) ? json.artifacts : [])
          setMigrationPending(Boolean(json.migrationPending))
          setNote(json.note || '')
        }
      } catch (error) {
        if (!cancelled) setNote(error instanceof Error ? error.message : 'Could not load candidate artifacts.')
      }
    })()
    return () => { cancelled = true }
  }, [candidateId])

  return <section className="product-panel">
    <div className="product-panel-head">
      <div><span className="kicker">Document provenance · V36.10</span><h2>Candidate artifacts</h2></div>
      <span>{artifacts.length} artifact{artifacts.length === 1 ? '' : 's'}</span>
    </div>
    <div className="cta" style={{ marginBottom: 14 }}><b>Documents remain source objects.</b> A resume, portfolio, ATS attachment, or profile export is preserved independently even when its identity observation is later attached to the same canonical person.</div>
    {migrationPending && <div className="cta" style={{ marginBottom: 14 }}><b>Migration pending.</b> The V36.10 artifact table has not been applied in this environment yet, so new artifact metadata cannot be durably stored here.</div>}
    {note && !artifacts.length && <p className="muted">{note}</p>}
    <div className="product-list">
      {artifacts.map(artifact => {
        const emails = artifact.identityAnchors?.observedEmails || []
        const profiles = artifact.identityAnchors?.professionalProfiles || []
        return <div className="product-row" key={artifact.id}>
          <div className="product-row-main">
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
              <div className="product-row-title">{artifact.fileName || words(artifact.artifactType)}</div>
              <span className="status-pill">{words(artifact.artifactType)}</span>
              <span className="status-pill">{words(artifact.dataOrigin)}</span>
            </div>
            <div className="product-row-meta">SHA-256 {artifact.contentSha256.slice(0, 12)}… · {artifact.rawTextLength.toLocaleString()} text chars · extractor {artifact.extractionVersion}</div>
            {(emails.length > 0 || profiles.length > 0) && <div style={{ marginTop: 8 }}>
              <span className="kicker">Observed identity anchors</span>
              <div className="chips" style={{ marginTop: 6 }}>
                {emails.slice(0, 5).map(email => <span className="tag" key={email}>email · {email}</span>)}
                {profiles.slice(0, 8).map(profile => <span className="tag" key={`${profile.network}:${profile.canonicalUrl}`}>{profile.network || 'profile'} · {profile.canonicalUrl}</span>)}
              </div>
            </div>}
          </div>
          {artifact.sourceUrl && <a className="btn ghost" href={artifact.sourceUrl} target="_blank" rel="noreferrer noopener">Open source</a>}
        </div>
      })}
      {!artifacts.length && !migrationPending && !note && <div className="product-row"><div className="product-row-main"><div className="product-row-title">No documents attached yet</div><div className="product-row-meta">Imported or discovered resumes and other artifacts will appear here with their original provenance.</div></div></div>}
    </div>
  </section>
}
