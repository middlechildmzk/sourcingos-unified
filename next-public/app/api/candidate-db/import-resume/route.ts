import { NextRequest, NextResponse } from 'next/server'
import { buildCandidateSummary, contactsFromText, evidenceFromText, getCandidateDb, inferOpenToWorkSignals, nowIso, SourceProfileRecord, uid } from '@/lib/candidate-db-v18'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const text = String(body.text || '')
    const fileName = String(body.fileName || 'pasted-resume.txt')
    const displayName = String(body.name || text.split('\n').find((line: string) => line.trim().length > 2)?.trim() || 'Resume import')
    if (text.trim().length < 20) return NextResponse.json({ ok: false, error: 'Resume text is too short to import.' }, { status: 400 })

    const db = getCandidateDb()
    const sourceProfile: SourceProfileRecord = {
      id: uid('sp'),
      source: 'uploaded_resume',
      sourceProfileId: fileName,
      displayName,
      headline: String(body.headline || 'Imported resume'),
      location: String(body.location || ''),
      organization: String(body.organization || ''),
      rawText: text,
      status: 'pending',
      matchScore: 0,
      matchReasons: ['Created from recruiter-provided resume text'],
      lastSeenAt: nowIso(),
      createdAt: nowIso()
    }

    const evidence = evidenceFromText(text, 'uploaded_resume', sourceProfile.id)
    const contacts = contactsFromText(text, 'uploaded_resume', sourceProfile.id)
    const openSignals = inferOpenToWorkSignals(text, 'uploaded_resume', sourceProfile.id)
    const summary = buildCandidateSummary(sourceProfile, evidence)
    const candidate = {
      id: uid('cand'),
      ...summary,
      createdAt: nowIso(),
      updatedAt: nowIso(),
      sourceProfileIds: [sourceProfile.id],
      evidenceItemIds: evidence.map(item => item.id),
      contactSignalIds: contacts.map(item => item.id),
      openToWorkSignalIds: openSignals.map(item => item.id),
      mergeStatus: 'pending' as const
    }

    sourceProfile.candidateId = candidate.id
    evidence.forEach(item => candidate.id && (item.candidateId = candidate.id))
    contacts.forEach(item => candidate.id && (item.candidateId = candidate.id))
    openSignals.forEach(item => candidate.id && (item.candidateId = candidate.id))

    db.candidates.unshift(candidate)
    db.sourceProfiles.unshift(sourceProfile)
    db.evidenceItems.unshift(...evidence)
    db.contactSignals.unshift(...contacts)
    db.openToWorkSignals.unshift(...openSignals)
    db.importBatches.unshift({ id: uid('batch'), importType: 'resume_text', fileName, rowsSeen: 1, recordsCreated: 1, warnings: [], createdAt: nowIso() })

    return NextResponse.json({ ok: true, candidate, sourceProfile, evidence, contacts, openToWorkSignals: openSignals })
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Import failed' }, { status: 500 })
  }
}
