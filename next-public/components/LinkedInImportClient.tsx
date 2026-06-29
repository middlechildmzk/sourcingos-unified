'use client'

import { useMemo, useState } from 'react'

type ImportRow = {
  firstName: string
  lastName: string
  fullName: string
  company: string
  position: string
  url: string
  email: string
  connectedOn: string
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    const next = text[i + 1]

    if (ch === '"' && quoted && next === '"') {
      cell += '"'
      i++
      continue
    }
    if (ch === '"') {
      quoted = !quoted
      continue
    }
    if (ch === ',' && !quoted) {
      row.push(cell.trim())
      cell = ''
      continue
    }
    if ((ch === '\n' || ch === '\r') && !quoted) {
      if (ch === '\r' && next === '\n') i++
      row.push(cell.trim())
      if (row.some(v => v)) rows.push(row)
      row = []
      cell = ''
      continue
    }
    cell += ch
  }

  row.push(cell.trim())
  if (row.some(v => v)) rows.push(row)
  return rows
}

function normalizeHeader(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '')
}

function pick(row: Record<string, string>, names: string[]): string {
  for (const name of names) {
    const value = row[normalizeHeader(name)]
    if (value) return value
  }
  return ''
}

function toRows(csv: string): ImportRow[] {
  const parsed = parseCsv(csv)
  if (parsed.length < 2) return []
  const headers = parsed[0].map(normalizeHeader)
  return parsed.slice(1).map(cells => {
    const row = Object.fromEntries(headers.map((h, i) => [h, cells[i] || '']))
    const firstName = pick(row, ['First Name', 'FirstName', 'Given Name'])
    const lastName = pick(row, ['Last Name', 'LastName', 'Surname'])
    const fullName = pick(row, ['Full Name', 'Name']) || [firstName, lastName].filter(Boolean).join(' ')
    return {
      firstName,
      lastName,
      fullName,
      company: pick(row, ['Company', 'Current Company', 'Organization']),
      position: pick(row, ['Position', 'Title', 'Current Position', 'Job Title']),
      url: pick(row, ['URL', 'Profile URL', 'LinkedIn URL', 'Public Profile URL']),
      email: pick(row, ['Email Address', 'Email', 'E-mail Address']),
      connectedOn: pick(row, ['Connected On', 'Connected Date', 'Connection Date']),
    }
  }).filter(row => row.fullName || row.firstName || row.lastName || row.url || row.email)
}

function handleToLinkedInUrl(value: string): string {
  const raw = value.trim()
  if (!raw) return ''
  if (/^https?:\/\//i.test(raw)) return raw
  const cleaned = raw.replace(/^@/, '').replace(/^linkedin\.com\/in\//i, '').replace(/^www\.linkedin\.com\/in\//i, '').replace(/^\/in\//i, '').replace(/\/+$/, '')
  return `https://www.linkedin.com/in/${cleaned}/`
}

function handleToName(value: string): string {
  const raw = value.trim()
  if (!raw) return ''
  if (/linkedin\.com\/in\//i.test(raw)) return raw.split('/in/')[1]?.replace(/[/?#].*$/, '').replace(/^\//, '') || raw
  if (/^https?:\/\//i.test(raw)) return raw.replace(/^https?:\/\//i, '').replace(/\/+$/, '')
  return raw.replace(/^@/, '')
}

function quickRowFromHandle(value: string): ImportRow | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  return {
    firstName: '',
    lastName: '',
    fullName: handleToName(trimmed),
    company: '',
    position: 'Manual network/profile import',
    url: handleToLinkedInUrl(trimmed),
    email: '',
    connectedOn: 'manual add',
  }
}

export function LinkedInImportClient() {
  const [csvText, setCsvText] = useState('')
  const [quickProfile, setQuickProfile] = useState('')
  const [status, setStatus] = useState('')
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<{ created?: number; skipped?: number; rowsSeen?: number; warnings?: string[]; mode?: string; note?: string } | null>(null)

  const csvRows = useMemo(() => toRows(csvText).slice(0, 500), [csvText])
  const quickRow = useMemo(() => quickRowFromHandle(quickProfile), [quickProfile])
  const rows = quickRow ? [quickRow] : csvRows
  const preview = rows.slice(0, 8)

  async function loadFile(file?: File) {
    if (!file) return
    const text = await file.text()
    setCsvText(text)
    setQuickProfile('')
    setResult(null)
    setStatus(`Loaded ${file.name}`)
  }

  async function importRows() {
    if (!rows.length) {
      setStatus('Add a LinkedIn handle/profile URL, or upload/paste your LinkedIn connections CSV first.')
      return
    }
    setImporting(true)
    setStatus(quickRow ? 'Adding profile to your private network...' : 'Importing LinkedIn connections...')
    setResult(null)
    try {
      const res = await fetch('/api/network/import-linkedin', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ rows, importLabel: quickRow ? 'Manual LinkedIn/profile add' : 'LinkedIn connections export' }),
      })
      let json: any = null
      try { json = await res.json() } catch { json = null }
      if (!res.ok || !json?.ok) {
        setStatus(json?.error || `Import failed with status ${res.status}. Make sure you are signed in.`)
        return
      }
      setResult(json)
      setStatus(`${quickRow ? 'Added' : 'Imported'} ${json.created || 0} record(s)${json.skipped ? `, skipped ${json.skipped}` : ''}.`)
    } catch {
      setStatus('Could not reach the import API. Refresh the page, confirm you are signed in, and try again.')
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="interactive-tool">
      <div className="cta">
        <strong>Relationship data only.</strong> Your LinkedIn export or manually added profile is imported as private network context.
        It does not mean someone is looking, qualified, contactable, or approved for outreach.
      </div>

      <div className="grid two">
        <div className="card">
          <span className="kicker">Quick add</span>
          <h3>Add one LinkedIn/profile handle</h3>
          <p className="muted" style={{ fontSize: '14px' }}>
            Paste a LinkedIn URL or handle like <code>dllarson1991</code>. This creates a pending private record you can enrich/review later.
          </p>
          <input
            type="text"
            value={quickProfile}
            onChange={e => { setQuickProfile(e.target.value); setResult(null) }}
            placeholder="dllarson1991 or https://www.linkedin.com/in/name/"
          />
          {quickRow ? (
            <p className="muted" style={{ fontSize: '12px', marginTop: '8px' }}>
              Will save as: {quickRow.fullName} · {quickRow.url}
            </p>
          ) : null}
        </div>

        <div className="card">
          <span className="kicker">Bulk CSV</span>
          <h3>Upload LinkedIn connections CSV</h3>
          <p className="muted" style={{ fontSize: '14px' }}>
            LinkedIn exports columns like First Name, Last Name, URL, Email Address, Company, Position, and Connected On.
          </p>
          <input type="file" accept=".csv,text/csv" onChange={e => loadFile(e.target.files?.[0])} />
          <textarea
            className="textarea big"
            value={csvText}
            onChange={e => { setCsvText(e.target.value); setQuickProfile(''); setResult(null) }}
            placeholder="Or paste your LinkedIn connections CSV here..."
            style={{ marginTop: '12px' }}
          />
        </div>
      </div>

      <div className="card" style={{ marginTop: '16px' }}>
        <span className="kicker">Review before import</span>
        <p className="muted" style={{ fontSize: '14px' }}>
          SourcingOS creates pending private records with unverified contact signals and evidence that the row came from your export or manual add.
        </p>
        <div className="grid" style={{ margin: '12px 0' }}>
          <div className="card"><span className="kicker">Rows detected</span><div className="big-number">{rows.length}</div></div>
        </div>
        <button className="btn" onClick={importRows} disabled={importing || !rows.length}>
          {importing ? 'Importing...' : quickRow ? 'Add profile' : 'Import LinkedIn connections'}
        </button>
        {status ? <div className="cta" style={{ marginTop: '12px' }}>{status}</div> : null}
        {result?.warnings?.length ? (
          <div className="preview-banner" style={{ marginTop: '12px' }}>
            <span className="pb-icon">◈</span>
            <span>{result.warnings.slice(0, 3).join(' ')}</span>
          </div>
        ) : null}
      </div>

      {preview.length > 0 && (
        <section>
          <h2>Import preview</h2>
          <div className="results">
            {preview.map((row, idx) => (
              <div className="result-card" key={`${row.fullName}-${idx}`}>
                <div className="result-head">
                  <span>{row.connectedOn || 'LinkedIn connection'}</span>
                  <span>pending review</span>
                </div>
                <h3>{row.fullName || [row.firstName, row.lastName].filter(Boolean).join(' ') || 'Unnamed connection'}</h3>
                <p className="muted">{[row.position, row.company].filter(Boolean).join(' at ') || 'No title/company in CSV'}</p>
                {row.url ? <a className="kicker" href={row.url} target="_blank" rel="noreferrer noopener">Open profile →</a> : null}
                {row.email ? <p className="muted" style={{ fontSize: '12px' }}>Email signal imported as unverified: {row.email}</p> : null}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
