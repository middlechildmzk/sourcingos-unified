import { NextRequest, NextResponse } from 'next/server'
import { rateLimit } from '@/lib/rate-limit'
import { requireSession } from '@/lib/auth-gate'
import { buildCandidateSummary, CandidateDbSnapshot, contactsFromText, evidenceFromText, getCandidateDb, inferOpenToWorkSignals, nowIso, SourceProfileRecord, uid } from '@/lib/candidate-db-v18'
import { persistCandidateGraphSnapshot } from '@/lib/supabase-candidate-graph'
import { isSupabaseConfigured } from '@/lib/supabase/server'

function parseCsv(text: string) {
  const records: string[][] = []
  let record: string[] = []
  let cell = ''
  let quoted = false
  for (let index = 0; index < text.length; index++) {
    const char = text[index]
    const next = text[index + 1]
    if (char === '"' && quoted && next === '"') { cell += '"'; index++; continue }
    if (char === '"') { quoted = !quoted; continue }
    if (char === ',' && !quoted) { record.push(cell.trim()); cell = ''; continue }
    if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && next === '\n') index++
      record.push(cell.trim()); cell = ''
      if (record.some(value => value.length)) records.push(record)
      record = []
      continue
    }
    cell += char
  }
  record.push(cell.trim())
  if (record.some(value => value.length)) records.push(record)
  if (records.length < 2) return []
  const headers = records[0].map(header => header.trim().toLowerCase().replace(/\s+/g, '_'))
  return records.slice(1).map(cells => Object.fromEntries(headers.map((header, index) => [header, cells[index] || ''])))
}

export async function POST(req: NextRequest) {
  const gate = await requireSession()
  if (!gate.ok) return gate.response
  const rl = await rateLimit(req, 'workbench', gate.userId)
  if (!rl.ok) return rl.response

  try {
    const body = await req.json()
    const csv = String(body.csv || '')
    const fileName = String(body.fileName || 'candidate-import.csv').slice(0, 240)
    if (csv.length > 5000000) return NextResponse.json({ ok: false, error: 'CSV exceeds the 5 MB paste-import limit.' }, { status: 413 })
    const rows = parseCsv(csv)
    if (!rows.length) return NextResponse.json({ ok: false, error: 'No CSV data rows found.' }, { status: 400 })

    const maximumRows = 1000
    const selectedRows = rows.slice(0, maximumRows)
    const createdAt = nowIso()
    const snapshot: CandidateDbSnapshot = { candidates: [], sourceProfiles: [], evidenceItems: [], contactSignals: [], openToWorkSignals: [], matchReviews: [], importBatches: [] }

    for (const row of selectedRows as Array<Record<string, string>>) {
      const name = row.name || row.fullname || row.full_name || row.candidate || 'CSV candidate'
      const headline = row.headline || row.title || row.current_title || 'Imported candidate'
      const location = row.location || row.city || row.metro || ''
      const organization = row.company || row.current_company || row.organization || ''
      const rawText = Object.entries(row).map(([key, value]) => `${key}: ${value}`).join('\n')
      const sourceProfile: SourceProfileRecord = {
        id: uid('sp'),
        source: 'csv_import',
        sourceProfileId: `${fileName}:${crypto.randomUUID()}`,
        displayName: name.slice(0, 300),
        headline: headline.slice(0, 300),
        location: location.slice(0, 200),
        organization: organization.slice(0, 200),
        rawText,
        status: 'pending',
        matchScore: 0,
        matchReasons: ['Created from recruiter-provided CSV import'],
        lastSeenAt: createdAt,
        createdAt,
      }
      const evidence = evidenceFromText(rawText, 'csv_import', sourceProfile.id)
      const contacts = contactsFromText(rawText, 'csv_import', sourceProfile.id)
      const openSignals = inferOpenToWorkSignals(rawText, 'csv_import', sourceProfile.id)
      const summary = buildCandidateSummary(sourceProfile, evidence)
      const candidate = { id: uid('cand'), ...summary, createdAt, updatedAt: createdAt, sourceProfileIds: [sourceProfile.id], evidenceItemIds: evidence.map(item => item.id), contactSignalIds: contacts.map(item => item.id), openToWorkSignalIds: openSignals.map(item => item.id), mergeStatus: 'pending' as const }
      sourceProfile.candidateId = candidate.id
      evidence.forEach(item => { item.candidateId = candidate.id })
      contacts.forEach(item => { item.candidateId = candidate.id })
      openSignals.forEach(item => { item.candidateId = candidate.id })
      snapshot.candidates.push(candidate)
      snapshot.sourceProfiles.push(sourceProfile)
      snapshot.evidenceItems.push(...evidence)
      snapshot.contactSignals.push(...contacts)
      snapshot.openToWorkSignals.push(...openSignals)
    }

    const warnings = rows.length > maximumRows ? [`Paste importer processed the first ${maximumRows.toLocaleString()} of ${rows.length.toLocaleString()} rows.`] : []
    const importBatch = { id: uid('batch'), importType: 'csv' as const, fileName, rowsSeen: rows.length, recordsCreated: snapshot.candidates.length, warnings, createdAt }
    snapshot.importBatches.push(importBatch)

    const preview = gate.preview || !isSupabaseConfigured()
    if (preview) {
      const db = getCandidateDb()
      db.candidates.unshift(...snapshot.candidates)
      db.sourceProfiles.unshift(...snapshot.sourceProfiles)
      db.evidenceItems.unshift(...snapshot.evidenceItems)
      db.contactSignals.unshift(...snapshot.contactSignals)
      db.openToWorkSignals.unshift(...snapshot.openToWorkSignals)
      db.importBatches.unshift(importBatch)
    } else {
      const persisted = await persistCandidateGraphSnapshot(snapshot, gate.userId)
      if (!persisted.ok) return NextResponse.json({ ok: false, error: persisted.message, details: persisted.errors || [] }, { status: 500 })
    }

    return NextResponse.json({ ok: true, persistence_mode: preview ? 'preview' : 'supabase', rowsSeen: rows.length, recordsCreated: snapshot.candidates.length, warnings, candidates: snapshot.candidates })
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'CSV import failed' }, { status: 500 })
  }
}
