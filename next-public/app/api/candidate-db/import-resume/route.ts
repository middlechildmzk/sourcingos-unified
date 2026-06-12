import { NextRequest, NextResponse } from 'next/server'
import { rateLimit } from '@/lib/rate-limit'
import { requireSession } from '@/lib/auth-gate'
import {
  buildCandidateSummary,
  contactsFromText,
  evidenceFromText,
  getCandidateDb,
  inferOpenToWorkSignals,
  nowIso,
  SourceProfileRecord,
  uid,
} from '@/lib/candidate-db-v18'
import { persistCandidateGraphSnapshot } from '@/lib/supabase-candidate-graph'
import { isSupabaseConfigured } from '@/lib/supabase/server'
import { getUserIdFromHeader } from '@/lib/supabase/auth'

export async function POST(req: NextRequest) {
  const gate = await requireSession()
  if (!gate.ok) return gate.response
  const rl = await rateLimit(req, 'workbench', gate.userId)
  if (!rl.ok) return rl.response

  try {
    const body = await req.json()
    const text = String(body.text || '')
    const fileName = String(body.fileName || 'pasted-resume.txt')
    const displayName = String(
      body.name ||
      text.split('\n').find((line: string) => line.trim().length > 2)?.trim() ||
      'Resume import'
    )
    if (text.trim().length < 20) {
      return NextResponse.json({ ok: false, error: 'Resume text is too short to import.' }, { status: 400 })
    }

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
      createdAt: nowIso(),
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
      mergeStatus: 'pending' as const,
    }

    sourceProfile.candidateId = candidate.id
    evidence.forEach(item => { if (candidate.id) item.candidateId = candidate.id })
    contacts.forEach(item => { if (candidate.id) item.candidateId = candidate.id })
    openSignals.forEach(item => { if (candidate.id) item.candidateId = candidate.id })

    db.candidates.unshift(candidate)
    db.sourceProfiles.unshift(sourceProfile)
    db.evidenceItems.unshift(...evidence)
    db.contactSignals.unshift(...contacts)
    db.openToWorkSignals.unshift(...openSignals)
    db.importBatches.unshift({
      id: uid('batch'),
      importType: 'resume_text',
      fileName,
      rowsSeen: 1,
      recordsCreated: 1,
      warnings: [],
      createdAt: nowIso(),
    })

    // ── Persistence to Supabase when configured ───────────────────────────────
    // Awaited so we can return an accurate persistence_mode — no false positives.
    let persistenceMode: 'supabase' | 'preview' = 'preview'
    let persistDetail: string | undefined

    if (isSupabaseConfigured()) {
      const userId = await getUserIdFromHeader(req.headers.get('authorization'))
      try {
        const persistResult = await persistCandidateGraphSnapshot(
          getCandidateDb(),
          userId ?? undefined
        )
        persistenceMode = persistResult.ok ? 'supabase' : 'preview'
        persistDetail = persistResult.message
        if (!persistResult.ok) {
          console.error('[SourcingOS import-resume] Persist failed:', persistResult.message)
        }
      } catch (err) {
        console.error('[SourcingOS import-resume] Persist error:', err)
        persistenceMode = 'preview'
        persistDetail = 'Persist threw an exception — falling back to preview mode.'
      }
    }

    return NextResponse.json({
      ok: true,
      persistence_mode: persistenceMode,
      ...(persistDetail ? { persistence_detail: persistDetail } : {}),
      candidate,
      sourceProfile,
      evidence,
      contacts,
      openToWorkSignals: openSignals,
    })
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Import failed' },
      { status: 500 }
    )
  }
}
