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

type ImportStats = {
  created: number
  skipped: number
  batches: number
  failed: number
}

const IMPORT_BATCH_SIZE = 50
const IMPORT_BATCH_PAUSE_MS = 2300

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
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

function looksLikeLinkedInHeader(cells: string[]): boolean {
  const headers = cells.map(normalizeHeader)
  const headerSet = new Set(headers)
  const compactCells = cells.map(c => c.trim()).filter(Boolean)

  const hasNames = headerSet.has('firstname') && headerSet.has('lastname')
  const hasProfile = headerSet.has('url') || headerSet.has('profileurl') || headerSet.has('linkedinurl') || headerSet.has('publicprofileurl')
  const hasWorkContext = headerSet.has('company') || headerSet.has('position') || headerSet.has('connectedon')
  const headerSized = compactCells.length >= 5 && compactCells.length <= 10
  const cellsLookLikeLabels = compactCells.every(cell => cell.length <= 40 && !/https?:\/\//i.test(cell))

  return hasNames && hasProfile && hasWorkContext && headerSized && cellsLookLikeLabels
}

function looksLikeConnectionRow(cells: string[]): boolean {
  const nonEmpty = cells.map(c => c.trim()).filter(Boolean)
  if (nonEmpty.length < 2) return false
  if (cells.some(c => /linkedin\.com\/in\//i.test(c))) return true
  if (cells.some(c => /@/.test(c)) && nonEmpty.length >= 3) return true
  return /^[a-z][a-z .'-]+$/i.test(nonEmpty[0] || '') && /^[a-z][a-z .'-]+$/i.test(nonEmpty[1] || '') && nonEmpty.length >= 4
}

function rowFromHeaders(headers: string[], cells: string[]): ImportRow {
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
    url: pick(row, ['URL', 'Profile URL', 'LinkedIn URL', 'Public Profile URL', 'ProfileLink']),
    email: pick(row, ['Email Address', 'Email', 'E-mail Address']),
    connectedOn: pick(row, ['Connected On', 'Connected Date', 'Connection Date', 'ConnectedOn']),
  }
}

function rowFromLinkedInCells(cells: string[]): ImportRow {
  const values = cells.map(c => c.trim())
  const firstName = values[0] || ''
  const lastName = values[1] || ''
  const urlIndex = values.findIndex(v => /linkedin\.com\/in\//i.test(v))
  const emailIndex = values.findIndex(v => /@/.test(v))
  const url = urlIndex >= 0 ? values[urlIndex] : ''
  const email = emailIndex >= 0 ? values[emailIndex] : ''

  const used = new Set([0, 1])
  if (urlIndex >= 0) used.add(urlIndex)
  if (emailIndex >= 0) used.add(emailIndex)

  const tail = values
    .map((value, index) => ({ value, index }))
    .filter(item => item.value && !used.has(item.index))

  const dateIndex = tail.findIndex(item => /\b\d{4}\b/.test(item.value) || /\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i.test(item.value))
  const connectedOn = dateIndex >= 0 ? tail[dateIndex].value : ''
  const remaining = tail.filter((_, index) => index !== dateIndex).map(item => item.value)

  return {
    firstName,
    lastName,
    fullName: [firstName, lastName].filter(Boolean).join(' '),
    company: remaining[0] || '',
    position: remaining[1] || '',
    url,
    email,
    connectedOn,
  }
}

function toRows(csv: string): ImportRow[] {
  const parsed = parseCsv(csv)
  if (parsed.length < 1) return []

  const headerIndex = parsed.findIndex(looksLikeLinkedInHeader)
  if (headerIndex >= 0 && parsed.length > headerIndex + 1) {
    const headers = parsed[headerIndex].map(normalizeHeader)
    return parsed.slice(headerIndex + 1)
      .map(cells => rowFromHeaders(headers, cells))
      .filter(row => row.fullName || row.firstName || row.lastName || row.url || row.email)
  }

  return parsed
    .filter(looksLikeConnectionRow)
    .map(rowFromLinkedInCells)
    .filter(row => row.fullName || row.firstName || row.lastName || row.url || row.email)
}

async function readJsonOrText(res: Response) {
  const text = await res.text()
  try {
    return text ? JSON.parse(text) : {}
  } catch {
    return { ok: false, error: text || `Request failed with status ${res.status}` }
  }
}

export function LinkedInImportClient() {
  const [csvText, setCsvText] = useState('')
  const [status, setStatus] = useState('')
  const [importing, setImporting] = useState(false)
  const [batchStart, setBatchStart] = useState(0)
  const [stats, setStats] = useState<ImportStats>({ created: 0, skipped: 0, batches: 0, failed: 0 })
  const [result, setResult] = useState<{ created?: number; skipped?: number; rowsSeen?: number; warnings?: string[]; mode?: string; note?: string } | null>(null)

  const allRows = useMemo(() => toRows(csvText), [csvText])
  const safeBatchStart = Math.min(batchStart, Math.max(0, allRows.length - (allRows.length % IMPORT_BATCH_SIZE || IMPORT_BATCH_SIZE)))
  const rowsToImport = useMemo(() => allRows.slice(safeBatchStart, safeBatchStart + IMPORT_BATCH_SIZE), [allRows, safeBatchStart])
  const preview = allRows.slice(safeBatchStart, safeBatchStart + 8)
  const hasLoadedCsvButNoRows = Boolean(csvText.trim()) && allRows.length === 0
  const totalBatches = allRows.length ? Math.ceil(allRows.length / IMPORT_BATCH_SIZE) : 0
  const currentBatch = allRows.length ? Math.floor(safeBatchStart / IMPORT_BATCH_SIZE) + 1 : 0
  const importedThrough = Math.min(safeBatchStart, allRows.length)

  async function loadFile(file?: File) {
    if (!file) return
    const text = await file.text()
    const detectedRows = toRows(text)
    setCsvText(text)
    setBatchStart(0)
    setStats({ created: 0, skipped: 0, batches: 0, failed: 0 })
    setResult(null)
    setStatus(detectedRows.length ? `Loaded ${file.name}. Detected ${detectedRows.length} connection row(s). Ready to import in safe ${IMPORT_BATCH_SIZE}-record batches.` : `Loaded ${file.name}, but no connection rows were detected yet.`)
  }

  async function postBatch(startIndex: number) {
    const batchRows = allRows.slice(startIndex, startIndex + IMPORT_BATCH_SIZE)
    if (!batchRows.length) return { ok: true, created: 0, skipped: 0, warnings: [] as string[] }

    const res = await fetch('/api/network/import-linkedin', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ rows: batchRows, importLabel: 'LinkedIn connections export' }),
    })
    const json = await readJsonOrText(res)
    if (!res.ok || !json.ok) {
      return { ok: false, error: json.error || `Import failed with status ${res.status}.`, created: 0, skipped: 0, warnings: Array.isArray(json.warnings) ? json.warnings : [] }
    }
    return { ok: true, created: Number(json.created || 0), skipped: Number(json.skipped || 0), warnings: Array.isArray(json.warnings) ? json.warnings : [] }
  }

  async function importCurrentBatch() {
    if (!rowsToImport.length) {
      setStatus('No rows left in the current batch. Load a CSV or move the batch selector back to the start.')
      return
    }
    setImporting(true)
    setStatus(`Importing rows ${safeBatchStart + 1}-${safeBatchStart + rowsToImport.length} of ${allRows.length}...`)
    setResult(null)
    try {
      const batchResult = await postBatch(safeBatchStart)
      if (!batchResult.ok) {
        setStats(prev => ({ ...prev, failed: prev.failed + 1 }))
        setStatus(batchResult.error || 'Import failed.')
        return
      }
      setStats(prev => ({
        created: prev.created + batchResult.created,
        skipped: prev.skipped + batchResult.skipped,
        batches: prev.batches + 1,
        failed: prev.failed,
      }))
      setResult({ created: batchResult.created, skipped: batchResult.skipped, warnings: batchResult.warnings })
      const nextStart = Math.min(safeBatchStart + IMPORT_BATCH_SIZE, allRows.length)
      setBatchStart(nextStart)
      const warningText = batchResult.warnings.length ? ` First issue: ${batchResult.warnings[0]}` : ''
      setStatus(`Imported current batch. Created ${batchResult.created}, skipped ${batchResult.skipped}. Next batch starts at row ${nextStart + 1}.${warningText}`)
    } catch (err) {
      setStats(prev => ({ ...prev, failed: prev.failed + 1 }))
      setStatus(err instanceof Error ? `Import request failed: ${err.message}` : 'Import request failed. Check your network connection and try again.')
    } finally {
      setImporting(false)
    }
  }

  async function importAllRemaining() {
    if (!allRows.length) {
      setStatus('No LinkedIn connection rows found. Upload or paste the LinkedIn connections CSV first.')
      return
    }

    setImporting(true)
    setResult(null)
    let created = 0
    let skipped = 0
    let batches = 0
    let failed = 0
    let start = safeBatchStart

    try {
      while (start < allRows.length) {
        const end = Math.min(start + IMPORT_BATCH_SIZE, allRows.length)
        setStatus(`Importing rows ${start + 1}-${end} of ${allRows.length}. Keep this tab open.`)
        setBatchStart(start)
        const batchResult = await postBatch(start)

        if (!batchResult.ok) {
          failed++
          setStats(prev => ({ ...prev, failed: prev.failed + 1 }))
          setStatus(`${batchResult.error || 'Import failed.'} Imported through row ${start}. You can retry from this batch.`)
          return
        }

        created += batchResult.created
        skipped += batchResult.skipped
        batches++
        start = end
        setBatchStart(start)
        setStats(prev => ({
          created: prev.created + batchResult.created,
          skipped: prev.skipped + batchResult.skipped,
          batches: prev.batches + 1,
          failed: prev.failed,
        }))
        setResult({ created: batchResult.created, skipped: batchResult.skipped, warnings: batchResult.warnings })

        if (start < allRows.length) await sleep(IMPORT_BATCH_PAUSE_MS)
      }

      setStatus(`Finished import run. Created ${created}, skipped ${skipped}, processed ${batches} batch(es). If earlier batches were already imported, skipped records are expected.`)
    } catch (err) {
      failed++
      setStats(prev => ({ ...prev, failed: prev.failed + 1 }))
      setStatus(err instanceof Error ? `Import run failed: ${err.message}` : 'Import run failed. You can retry from the current batch.')
    } finally {
      if (failed === 0) setBatchStart(allRows.length)
      setImporting(false)
    }
  }

  function jumpToNextBatch() {
    setBatchStart(prev => Math.min(prev + IMPORT_BATCH_SIZE, allRows.length))
  }

  function restartBatches() {
    setBatchStart(0)
    setStats({ created: 0, skipped: 0, batches: 0, failed: 0 })
    setResult(null)
    setStatus(allRows.length ? 'Reset to the first batch. Duplicate rows should be skipped by the backend if they were already imported.' : '')
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
            Position, and Connected On. SourcingOS also handles exports with intro lines or missing headers.
          </p>
          <input type="file" accept=".csv,text/csv" onChange={e => loadFile(e.target.files?.[0])} />
          <textarea
            className="textarea big"
            value={csvText}
            onChange={e => { setCsvText(e.target.value); setBatchStart(0); setStats({ created: 0, skipped: 0, batches: 0, failed: 0 }); setResult(null) }}
            placeholder="Or paste your LinkedIn connections CSV here..."
            style={{ marginTop: '12px' }}
          />
        </div>

        <div className="card">
          <span className="kicker">Step 2</span>
          <h3>Review and import</h3>
          <p className="muted" style={{ fontSize: '14px' }}>
            Imports run in safe {IMPORT_BATCH_SIZE}-record batches. For a 29k-row export, Import all remaining may take 20-30 minutes. Keep this tab open.
          </p>
          <div className="grid" style={{ margin: '12px 0' }}>
            <div className="card"><span className="kicker">Rows detected</span><div className="big-number">{allRows.length}</div></div>
            <div className="card"><span className="kicker">Current batch</span><div className="big-number">{currentBatch}/{totalBatches}</div></div>
            <div className="card"><span className="kicker">Processed through</span><div className="big-number">{importedThrough}</div></div>
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button className="btn" onClick={importCurrentBatch} disabled={importing || !rowsToImport.length}>
              {importing ? 'Importing...' : `Import this batch (${rowsToImport.length})`}
            </button>
            <button className="btn secondary" onClick={importAllRemaining} disabled={importing || !allRows.length || safeBatchStart >= allRows.length}>
              Import all remaining
            </button>
            <button className="btn ghost" onClick={jumpToNextBatch} disabled={importing || safeBatchStart >= allRows.length}>
              Skip to next batch
            </button>
            <button className="btn ghost" onClick={restartBatches} disabled={importing || !allRows.length}>
              Reset to start
            </button>
          </div>
          <p className="muted" style={{ fontSize: '12px', marginTop: '8px' }}>
            Current rows: {rowsToImport.length ? `${safeBatchStart + 1}-${safeBatchStart + rowsToImport.length}` : 'none'} of {allRows.length}. Created this session: {stats.created}. Skipped: {stats.skipped}. Batches: {stats.batches}. Failed: {stats.failed}.
          </p>
          {status ? <div className="cta" style={{ marginTop: '12px' }}>{status}</div> : null}
          {hasLoadedCsvButNoRows ? (
            <div className="preview-banner" style={{ marginTop: '12px', borderColor: 'rgba(246,201,107,.35)' }}>
              <span className="pb-icon">◈</span>
              <span>
                No rows detected yet. Your file may not include the standard LinkedIn Connections columns, or the first visible lines may be export notes.
                Try opening the CSV and make sure it includes names and LinkedIn profile URLs.
              </span>
            </div>
          ) : null}
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
          <h2>Current batch preview</h2>
          <div className="results">
            {preview.map((row, idx) => (
              <div className="result-card" key={`${row.fullName}-${safeBatchStart + idx}`}>
                <div className="result-head">
                  <span>{row.connectedOn || 'LinkedIn connection'}</span>
                  <span>row {safeBatchStart + idx + 1}</span>
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
