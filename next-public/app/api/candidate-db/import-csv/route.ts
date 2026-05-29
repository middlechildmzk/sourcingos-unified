import { NextRequest, NextResponse } from 'next/server'
import { buildCandidateSummary, contactsFromText, evidenceFromText, getCandidateDb, inferOpenToWorkSignals, nowIso, SourceProfileRecord, uid } from '@/lib/candidate-db-v18'

function parseCsv(text: string) {
  const lines = text.split(/\r?\n/).map(line => line.trim()).filter(Boolean)
  if (!lines.length) return []
  const headers = lines[0].split(',').map(h => h.trim().toLowerCase())
  return lines.slice(1).map(line => {
    const cells = line.split(',').map(c => c.trim())
    return Object.fromEntries(headers.map((h, i) => [h, cells[i] || '']))
  })
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const csv = String(body.csv || '')
    const fileName = String(body.fileName || 'candidate-import.csv')
    const rows = parseCsv(csv)
    if (!rows.length) return NextResponse.json({ ok: false, error: 'No CSV rows found.' }, { status: 400 })

    const db = getCandidateDb()
    const created = rows.slice(0, 100).map((row: Record<string,string>) => {
      const name = row.name || row.fullname || row.full_name || row.candidate || 'CSV candidate'
      const headline = row.headline || row.title || row.current_title || 'Imported candidate'
      const location = row.location || row.city || ''
      const organization = row.company || row.current_company || ''
      const text = Object.entries(row).map(([k,v]) => `${k}: ${v}`).join('\n')
      const sourceProfile: SourceProfileRecord = { id: uid('sp'), source: 'csv_import', sourceProfileId: `${fileName}:${name}:${Math.random().toString(36).slice(2,6)}`, displayName: name, headline, location, organization, rawText: text, status: 'pending', matchScore: 0, matchReasons: ['Created from recruiter-provided CSV import'], lastSeenAt: nowIso(), createdAt: nowIso() }
      const evidence = evidenceFromText(text, 'csv_import', sourceProfile.id)
      const contacts = contactsFromText(text, 'csv_import', sourceProfile.id)
      const openSignals = inferOpenToWorkSignals(text, 'csv_import', sourceProfile.id)
      const summary = buildCandidateSummary(sourceProfile, evidence)
      const candidate = { id: uid('cand'), ...summary, createdAt: nowIso(), updatedAt: nowIso(), sourceProfileIds: [sourceProfile.id], evidenceItemIds: evidence.map(i => i.id), contactSignalIds: contacts.map(i => i.id), openToWorkSignalIds: openSignals.map(i => i.id), mergeStatus: 'pending' as const }
      sourceProfile.candidateId = candidate.id
      evidence.forEach(item => item.candidateId = candidate.id)
      contacts.forEach(item => item.candidateId = candidate.id)
      openSignals.forEach(item => item.candidateId = candidate.id)
      db.candidates.unshift(candidate); db.sourceProfiles.unshift(sourceProfile); db.evidenceItems.unshift(...evidence); db.contactSignals.unshift(...contacts); db.openToWorkSignals.unshift(...openSignals)
      return candidate
    })
    db.importBatches.unshift({ id: uid('batch'), importType: 'csv', fileName, rowsSeen: rows.length, recordsCreated: created.length, warnings: rows.length > 100 ? ['Preview importer capped at 100 rows.'] : [], createdAt: nowIso() })
    return NextResponse.json({ ok: true, rowsSeen: rows.length, recordsCreated: created.length, candidates: created })
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'CSV import failed' }, { status: 500 })
  }
}
