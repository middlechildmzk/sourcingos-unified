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

export function LinkedInImportClient() {
  const [csvText, setCsvText] = useState('')
  const [status, setStatus] = useState('')
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<{ created?: number; skipped?: number; rowsSeen?: number; warnings?: string[]; mode?: string; note?: string } | null>(null)

  const rows = useMemo(() => toRows(csvText).slice(0, 500), [csvText])
  const preview = rows.slice(0, 8)

  async function loadFile(file?: File) {
    if (!file) return
    const text = await file.text()
    setCsvText(text)
    setResult(null)
    setStatus(`Loaded ${file.name}`)
  }

  async function importRows() {
    if (!rows.length) {
      setStatus('No LinkedIn connection rows found. Export your LinkedIn connections as CSV, then upload or paste it here.')
      return
    }
    setImporting(true)
    setStatus('Importing LinkedIn connections...')
    setResult(null)
    try {
      const res = await fetch('/api/network/import-linkedin', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ rows, importLabel: 'LinkedIn connections export' }),
      })
      const json = await res.json()
      if (!res.ok || !json.ok) {
        setStatus(json.error || 'Import failed.')
        return
      }
      setResult(json)
      setStatus(`Imported ${json.created || 0} connection record(s)${json.skipped ? `, skipped ${json.skipped}` : ''}.`)
    } catch {
      setStatus('Import failed. Check your network connection and try again.')
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="interactive-tool">
      <div className="cta">
        <strong>Relationship data only.</strong> Your LinkedIn export is imported as private network context.
        It does not mean someone is looking, qualified, contactable, or approved for outreach.
      </div>

      <div className="grid two">
        <div className="card">
          <span className="kicker">Step 1</span>
          <h3>Upload LinkedIn connections CSV</h3>
          <p className="muted" style={{ fontSize: '14px' }}>
            LinkedIn usually exports columns like First Name, Last Name, URL, Email Address, Company,
            Position, and Connected On.
          </p>
          <input type="file" accept=".csv,text/csv" onChange={e => loadFile(e.target.files?.[0])} />
          <textarea
            className="textarea big"
            value={csvText}
            onChange={e => { setCsvText(e.target.value); setResult(null) }}
            placeholder="Or paste your LinkedIn connections CSV here..."
            style={{ marginTop: '12px' }}
          />
        </div>

        <div className="card">
          <span className="kicker">Step 2</span>
          <h3>Review before import</h3>
          <p className="muted" style={{ fontSize: '14px' }}>
            SourcingOS will create pending private records with unverified contact signals and evidence that the row came from your LinkedIn export.
          </p>
          <div className="grid" style={{ margin: '12px 0' }}>
            <div className="card"><span className="kicker">Rows detected</span><div className="big-number">{rows.length}</div></div>
          </div>
          <button className="btn" onClick={importRows} disabled={importing || !rows.length}>
            {importing ? 'Importing...' : 'Import LinkedIn connections'}
          </button>
          {status ? <div className="cta" style={{ marginTop: '12px' }}>{status}</div> : null}
          {result?.warnings?.length ? (
            <div className="preview-banner" style={{ marginTop: '12px' }}>
              <span className="pb-icon">◈</span>
              <span>{result.warnings.slice(0, 3).join(' ')}</span>
            </div>
          ) : null}
        </div>
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
                {row.url ? <a className="kicker" href={row.url} target="_blank" rel="noreferrer noopener">Open LinkedIn profile →</a> : null}
                {row.email ? <p className="muted" style={{ fontSize: '12px' }}>Email signal imported as unverified: {row.email}</p> : null}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
