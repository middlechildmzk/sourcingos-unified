'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'

const FIELD_KEYS = ['name', 'title', 'company', 'location', 'email', 'phone', 'linkedin', 'skills'] as const
type FieldKey = (typeof FIELD_KEYS)[number]
type Mapping = Record<FieldKey, string>
type ImportState = 'ready' | 'checking' | 'importing' | 'done' | 'error'

type DuplicateMatch = {
  id: string
  canonicalName: string
  headline?: string
  currentCompany?: string
  location?: string
  mergeStatus?: string
  confidence: 'high' | 'possible'
}

type DuplicatePreview = {
  index: number
  name: string
  company: string
  matches: DuplicateMatch[]
}

type ParsedImportFile = {
  id: string
  name: string
  size: number
  kind: 'tabular' | 'resume'
  text: string
  delimiter: string
  headers: string[]
  rows: string[][]
  mapping: Mapping
  warnings: string[]
  status: ImportState
  result?: string
  duplicates: DuplicatePreview[]
}

type ImportBatch = {
  id: string
  importType: string
  fileName?: string
  rowsSeen: number
  recordsCreated: number
  warnings: string[]
  createdAt: string
}

const synonyms: Record<FieldKey, string[]> = {
  name: ['name', 'full name', 'fullname', 'full_name', 'candidate', 'candidate name'],
  title: ['title', 'headline', 'current title', 'current_title', 'job title', 'job_title'],
  company: ['company', 'current company', 'current_company', 'organization', 'employer'],
  location: ['location', 'city', 'metro', 'city state', 'city_state', 'region'],
  email: ['email', 'email address', 'email_address', 'personal email', 'personal_email'],
  phone: ['phone', 'phone number', 'phone_number', 'mobile', 'cell', 'cell phone'],
  linkedin: ['linkedin', 'linkedin url', 'linkedin_url', 'profile url', 'profile_url'],
  skills: ['skills', 'keywords', 'tags', 'expertise', 'competencies'],
}

function normalized(value: string) {
  return value.trim().toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ')
}

function emptyMapping(): Mapping {
  return { name: '', title: '', company: '', location: '', email: '', phone: '', linkedin: '', skills: '' }
}

function inferMapping(headers: string[]): Mapping {
  const mapping = emptyMapping()
  for (const field of FIELD_KEYS) {
    const candidates = synonyms[field]
    mapping[field] = headers.find(header => candidates.includes(normalized(header))) || ''
  }
  return mapping
}

function delimiterCount(line: string, delimiter: string) {
  let quoted = false
  let count = 0
  for (let index = 0; index < line.length; index++) {
    const char = line[index]
    if (char === '"') quoted = !quoted
    if (!quoted && char === delimiter) count++
  }
  return count
}

function detectDelimiter(text: string, fileName: string) {
  if (fileName.toLowerCase().endsWith('.tsv')) return '\t'
  const firstLine = text.split(/\r?\n/, 1)[0] || ''
  return [',', '\t', ';', '|'].sort((a, b) => delimiterCount(firstLine, b) - delimiterCount(firstLine, a))[0]
}

function parseDelimited(text: string, delimiter: string) {
  const records: string[][] = []
  let record: string[] = []
  let cell = ''
  let quoted = false
  for (let index = 0; index < text.length; index++) {
    const char = text[index]
    const next = text[index + 1]
    if (char === '"' && quoted && next === '"') { cell += '"'; index++; continue }
    if (char === '"') { quoted = !quoted; continue }
    if (char === delimiter && !quoted) { record.push(cell.trim()); cell = ''; continue }
    if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && next === '\n') index++
      record.push(cell.trim())
      cell = ''
      if (record.some(value => value.length)) records.push(record)
      record = []
      continue
    }
    cell += char
  }
  record.push(cell.trim())
  if (record.some(value => value.length)) records.push(record)
  return records
}

function csvCell(value: string) {
  const clean = String(value || '')
  return /[",\n\r]/.test(clean) ? `"${clean.replaceAll('"', '""')}"` : clean
}

function formatBytes(value: number) {
  if (value < 1024) return `${value} B`
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`
  return `${(value / (1024 * 1024)).toFixed(1)} MB`
}

function formatDate(value: string) {
  const date = new Date(value)
  return Number.isFinite(date.getTime()) ? date.toLocaleString() : value
}

function valueFor(file: ParsedImportFile, row: string[], field: FieldKey) {
  const header = file.mapping[field]
  if (!header) return ''
  const index = file.headers.indexOf(header)
  return index >= 0 ? String(row[index] || '').trim() : ''
}

async function parseFile(file: File): Promise<ParsedImportFile> {
  if (file.size > 5_000_000) throw new Error(`${file.name} exceeds the 5 MB per-file limit.`)
  const text = await file.text()
  const delimiter = detectDelimiter(text, file.name)
  const matrix = parseDelimited(text, delimiter)
  const extension = file.name.toLowerCase().split('.').pop() || ''
  const tabular = ['csv', 'tsv'].includes(extension) || (matrix.length >= 2 && (matrix[0]?.length || 0) >= 2)
  if (!tabular) {
    return { id: crypto.randomUUID(), name: file.name, size: file.size, kind: 'resume', text, delimiter: '', headers: [], rows: [], mapping: emptyMapping(), warnings: text.trim().length < 80 ? ['This text file is very short and may not contain a complete resume or profile.'] : [], status: 'ready', duplicates: [] }
  }
  const headers = (matrix[0] || []).map((header, index) => header.trim() || `Column ${index + 1}`)
  const rows = matrix.slice(1).filter(row => row.some(value => value.trim())).slice(0, 1000)
  const warnings: string[] = []
  if (matrix.length - 1 > 1000) warnings.push(`Only the first 1,000 of ${(matrix.length - 1).toLocaleString()} rows can be imported per file in this release.`)
  const mapping = inferMapping(headers)
  if (!mapping.name) warnings.push('Map a candidate-name column before importing.')
  return { id: crypto.randomUUID(), name: file.name, size: file.size, kind: 'tabular', text, delimiter, headers, rows, mapping, warnings, status: 'ready', duplicates: [] }
}

export function ImportCenterClient() {
  const fileInput = useRef<HTMLInputElement>(null)
  const [files, setFiles] = useState<ParsedImportFile[]>([])
  const [history, setHistory] = useState<ImportBatch[]>([])
  const [status, setStatus] = useState('Choose authorized exports, CSV/TSV files, or plain-text resumes.')
  const [skipHighConfidenceDuplicates, setSkipHighConfidenceDuplicates] = useState(true)
  const [busy, setBusy] = useState(false)

  async function loadHistory() {
    try {
      const response = await fetch('/api/candidate-db/import-history', { headers: { accept: 'application/json' }, cache: 'no-store' })
      const json = await response.json()
      if (response.ok && json.ok) setHistory(Array.isArray(json.batches) ? json.batches : [])
    } catch {
      setHistory([])
    }
  }

  useEffect(() => { void loadHistory() }, [])

  const totals = useMemo(() => files.reduce((summary, file) => {
    summary.files += 1
    summary.rows += file.kind === 'tabular' ? file.rows.length : 1
    summary.duplicates += file.duplicates.filter(item => item.matches.some(match => match.confidence === 'high')).length
    summary.ready += file.status === 'ready' ? 1 : 0
    return summary
  }, { files: 0, rows: 0, duplicates: 0, ready: 0 }), [files])

  function patchFile(fileId: string, patch: Partial<ParsedImportFile>) {
    setFiles(current => current.map(file => file.id === fileId ? { ...file, ...patch } : file))
  }

  async function addFiles(selected: FileList | null) {
    if (!selected?.length) return
    const incoming = Array.from(selected).slice(0, Math.max(0, 20 - files.length))
    const totalBytes = [...files.map(file => file.size), ...incoming.map(file => file.size)].reduce((sum, value) => sum + value, 0)
    if (totalBytes > 15_000_000) {
      setStatus('The selected batch exceeds the 15 MB browser preparation limit. Split it into smaller batches.')
      return
    }
    setBusy(true)
    setStatus(`Preparing ${incoming.length} file${incoming.length === 1 ? '' : 's'}…`)
    const parsed: ParsedImportFile[] = []
    for (const file of incoming) {
      try {
        parsed.push(await parseFile(file))
      } catch (error) {
        parsed.push({ id: crypto.randomUUID(), name: file.name, size: file.size, kind: 'resume', text: '', delimiter: '', headers: [], rows: [], mapping: emptyMapping(), warnings: [error instanceof Error ? error.message : 'File could not be read.'], status: 'error', result: 'Preparation failed.', duplicates: [] })
      }
    }
    setFiles(current => [...current, ...parsed])
    setStatus(`Prepared ${parsed.length} file${parsed.length === 1 ? '' : 's'} for review.`)
    setBusy(false)
    if (fileInput.current) fileInput.current.value = ''
  }

  async function checkDuplicates(file: ParsedImportFile) {
    if (file.kind !== 'tabular') return
    if (!file.mapping.name) { patchFile(file.id, { status: 'error', result: 'Map a candidate-name column first.' }); return }
    patchFile(file.id, { status: 'checking', result: 'Checking the connected Candidate Graph…' })
    const rows = file.rows.slice(0, 40).map(row => ({ name: valueFor(file, row, 'name'), company: valueFor(file, row, 'company'), email: valueFor(file, row, 'email') })).filter(row => row.name)
    try {
      const response = await fetch('/api/candidate-db/import-preview', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ rows }) })
      const json = await response.json()
      if (!response.ok || !json.ok) throw new Error(json.error || 'Duplicate preview failed.')
      const duplicates = Array.isArray(json.duplicates) ? json.duplicates : []
      patchFile(file.id, { status: 'ready', duplicates, result: `${json.checked || rows.length} row${(json.checked || rows.length) === 1 ? '' : 's'} checked. ${duplicates.length} possible duplicate${duplicates.length === 1 ? '' : 's'} found.` })
    } catch (error) {
      patchFile(file.id, { status: 'error', result: error instanceof Error ? error.message : 'Duplicate preview failed.' })
    }
  }

  function buildCanonicalCsv(file: ParsedImportFile) {
    const highDuplicateIndexes = new Set(file.duplicates.filter(item => item.matches.some(match => match.confidence === 'high')).map(item => item.index))
    const rows = file.rows.filter((row, index) => {
      if (!valueFor(file, row, 'name')) return false
      return !(skipHighConfidenceDuplicates && highDuplicateIndexes.has(index))
    })
    const header = FIELD_KEYS.join(',')
    const body = rows.map(row => FIELD_KEYS.map(field => csvCell(valueFor(file, row, field))).join(',')).join('\n')
    return { csv: `${header}\n${body}`, rows: rows.length }
  }

  async function importOne(file: ParsedImportFile) {
    if (file.status === 'importing' || file.status === 'done') return
    patchFile(file.id, { status: 'importing', result: 'Importing into the Candidate Graph…' })
    try {
      let response: Response
      if (file.kind === 'tabular') {
        if (!file.mapping.name) throw new Error('Map a candidate-name column before importing.')
        const canonical = buildCanonicalCsv(file)
        if (!canonical.rows) throw new Error('No importable rows remain after mapping and duplicate exclusions.')
        response = await fetch('/api/candidate-db/import-csv', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ csv: canonical.csv, fileName: file.name }) })
      } else {
        if (file.text.trim().length < 20) throw new Error('Resume text is too short to import.')
        response = await fetch('/api/candidate-db/import-resume', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text: file.text, fileName: file.name }) })
      }
      const json = await response.json()
      if (!response.ok || !json.ok) throw new Error(json.error || 'Import failed.')
      const created = file.kind === 'tabular' ? Number(json.recordsCreated || 0) : 1
      patchFile(file.id, { status: 'done', result: `Imported ${created.toLocaleString()} candidate record${created === 1 ? '' : 's'} to ${json.persistence_mode === 'supabase' ? 'your account' : 'the preview workspace'}.` })
    } catch (error) {
      patchFile(file.id, { status: 'error', result: error instanceof Error ? error.message : 'Import failed.' })
    }
  }

  async function importAll() {
    const pending = files.filter(file => file.status !== 'done' && file.text)
    if (!pending.length) { setStatus('There are no prepared files to import.'); return }
    setBusy(true)
    setStatus(`Importing ${pending.length} file${pending.length === 1 ? '' : 's'} sequentially…`)
    for (const file of pending) await importOne(file)
    setBusy(false)
    setStatus('Import run finished. Review any file-level warnings below.')
    await loadHistory()
  }

  return <div className="interactive-tool">
    <div className="product-page-head">
      <div><span className="kicker">Authorized data onboarding</span><h1>Import Center</h1><p>Prepare multiple recruiter-owned exports and resumes, map fields, preview duplicates, and import into the owner-scoped Candidate Graph.</p></div>
      <div className="product-page-actions"><button className="btn secondary" onClick={() => fileInput.current?.click()} disabled={busy}>Choose files</button><button className="btn" onClick={importAll} disabled={busy || !files.length}>{busy ? 'Working…' : 'Import prepared files'}</button></div>
    </div>

    <input ref={fileInput} type="file" multiple accept=".csv,.tsv,.txt,text/csv,text/tab-separated-values,text/plain" hidden onChange={event => void addFiles(event.target.files)} />
    <button className="import-dropzone" onClick={() => fileInput.current?.click()} disabled={busy}><b>Drop workflow foundation</b><span>Select up to 20 CSV, TSV, or plain-text resume files. Each file is reviewed before it enters the graph.</span><small>5 MB per file · 15 MB prepared batch · 1,000 rows per tabular file</small></button>
    <div className="cta" role="status">{status}</div>

    <div className="product-summary-grid">
      <div className="product-stat"><small>Prepared files</small><b>{totals.files}</b><span>Up to 20 per batch</span></div>
      <div className="product-stat"><small>Candidate rows</small><b>{totals.rows}</b><span>Before duplicate exclusions</span></div>
      <div className="product-stat"><small>High-confidence duplicates</small><b>{totals.duplicates}</b><span>Excluded when enabled</span></div>
      <div className="product-stat"><small>Ready</small><b>{totals.ready}</b><span>Mapped and importable</span></div>
    </div>

    {!!files.length && <section className="product-panel" style={{ marginBottom: 14 }}><label className="import-checkbox"><input type="checkbox" checked={skipHighConfidenceDuplicates} onChange={event => setSkipHighConfidenceDuplicates(event.target.checked)} /> Skip rows with high-confidence name and company duplicates after a dry run</label></section>}

    <div style={{ display: 'grid', gap: 14 }}>
      {files.map(file => <section className="product-panel" key={file.id}>
        <div className="product-panel-head"><div><div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}><span className="kicker">{file.kind === 'tabular' ? 'Tabular import' : 'Resume text'}</span><span className={`status-pill ${file.status === 'done' ? 'success' : file.status === 'error' ? 'warning' : file.status === 'importing' || file.status === 'checking' ? 'active' : ''}`}>{file.status}</span></div><h2>{file.name}</h2></div><span>{formatBytes(file.size)} · {file.kind === 'tabular' ? `${file.rows.length} rows` : '1 profile'}</span></div>
        {!!file.warnings.length && <div className="cta">{file.warnings.join(' ')}</div>}

        {file.kind === 'tabular' && <>
          <div className="import-mapping-grid">{FIELD_KEYS.map(field => <label key={field}>{field === 'name' ? 'Candidate name *' : field}<select value={file.mapping[field]} onChange={event => patchFile(file.id, { mapping: { ...file.mapping, [field]: event.target.value }, duplicates: [], status: 'ready', result: undefined })}><option value="">Not mapped</option>{file.headers.map(header => <option value={header} key={header}>{header}</option>)}</select></label>)}</div>
          <div className="import-preview-table"><table><thead><tr><th>#</th>{FIELD_KEYS.slice(0, 6).map(field => <th key={field}>{field}</th>)}</tr></thead><tbody>{file.rows.slice(0, 6).map((row, index) => <tr key={index}><td>{index + 1}</td>{FIELD_KEYS.slice(0, 6).map(field => <td key={field}>{valueFor(file, row, field) || '—'}</td>)}</tr>)}</tbody></table></div>
          {!!file.duplicates.length && <details className="advanced-disclosure"><summary>Possible duplicates ({file.duplicates.length})</summary><div className="product-list" style={{ marginTop: 12 }}>{file.duplicates.map(duplicate => <div className="product-row" key={`${duplicate.index}-${duplicate.name}`}><div className="product-row-main"><div className="product-row-title">Row {duplicate.index + 1}: {duplicate.name}</div><div className="product-row-meta">{duplicate.matches.map(match => `${match.canonicalName}${match.currentCompany ? ` at ${match.currentCompany}` : ''} (${match.confidence})`).join(' · ')}</div></div><span className={`status-pill ${duplicate.matches.some(match => match.confidence === 'high') ? 'warning' : ''}`}>{duplicate.matches[0]?.confidence || 'possible'}</span></div>)}</div></details>}
        </>}

        {file.kind === 'resume' && <details className="advanced-disclosure"><summary>Preview resume text</summary><pre style={{ whiteSpace: 'pre-wrap' }}>{file.text.slice(0, 4000)}</pre></details>}
        {file.result && <div className="role-storage-note" style={{ marginTop: 10 }}>{file.result}</div>}
        <div className="button-row" style={{ marginTop: 14 }}>{file.kind === 'tabular' && <button className="btn secondary" disabled={file.status === 'checking' || file.status === 'importing'} onClick={() => void checkDuplicates(file)}>{file.status === 'checking' ? 'Checking…' : 'Dry run duplicates'}</button>}<button className="btn" disabled={file.status === 'checking' || file.status === 'importing' || file.status === 'done'} onClick={() => void importOne(file)}>{file.status === 'importing' ? 'Importing…' : file.status === 'done' ? 'Imported' : 'Import file'}</button><button className="btn ghost" disabled={file.status === 'importing'} onClick={() => setFiles(current => current.filter(item => item.id !== file.id))}>Remove</button></div>
      </section>)}
    </div>

    <section className="product-panel" style={{ marginTop: 14 }}>
      <div className="product-panel-head"><div><span className="kicker">Audit trail</span><h2>Recent imports</h2></div><button className="btn ghost" onClick={() => void loadHistory()}>Refresh</button></div>
      <div className="product-list">{history.map(batch => <div className="product-row" key={batch.id}><div className="product-row-main"><div className="product-row-title">{batch.fileName || words(batch.importType)}</div><div className="product-row-meta">{batch.recordsCreated.toLocaleString()} created from {batch.rowsSeen.toLocaleString()} row{batch.rowsSeen === 1 ? '' : 's'} · {formatDate(batch.createdAt)}</div>{batch.warnings?.length ? <div className="role-storage-note">{batch.warnings.join(' ')}</div> : null}</div><span className="status-pill success">{words(batch.importType)}</span></div>)}{!history.length && <div className="product-row"><div className="product-row-main"><div className="product-row-title">No import history yet</div><div className="product-row-meta">Completed owner-scoped imports will appear here.</div></div></div>}</div>
    </section>

    <div className="cta" style={{ marginTop: 14 }}><b>Supported now:</b> CSV, TSV, and plain-text resumes. Native XLSX parsing is intentionally not enabled until a locked spreadsheet dependency and workbook safety review are added. Export an XLSX tab as CSV for this release. <Link href="/app/candidate-database">Open Candidates →</Link></div>
  </div>
}

function words(value: string) { return value.replaceAll('_', ' ') }
