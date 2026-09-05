import { NextRequest, NextResponse } from 'next/server'
import { rateLimit } from '@/lib/rate-limit'
import { requireSession } from '@/lib/auth-gate'
import {
  buildCandidateSummary,
  CandidateDbSnapshot,
  contactsFromText,
  evidenceFromText,
  getCandidateDb,
  inferOpenToWorkSignals,
  nowIso,
  SourceProfileRecord,
  uid,
} from '@/lib/candidate-db-v18'
import { buildCandidateArtifactV36_10, persistCandidateArtifactV36_10 } from '@/lib/candidate-artifacts-v36-10'
import { persistCandidateGraphSnapshot } from '@/lib/supabase-candidate-graph'
import { createServerSupabaseClient, isSupabaseConfigured } from '@/lib/supabase/server'

function safeProfileUrl(value: unknown): string | undefined {
  const raw = String(value || '').trim().slice(0, 1000)
  if (!raw) return undefined
  try {
    const parsed = new URL(raw)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return undefined
    return parsed.toString().slice(0, 1000)
  } catch {
    return undefined
  }
}

export async function POST(req: NextRequest) {
  const gate = await requireSession()
  if (!gate.ok) return gate.response
  const rl = await rateLimit(req, 'workbench', gate.userId)
  if (!rl.ok) return rl.response

  try {
    const body = await req.json()
    const text = String(body.text || '')
    const fileName = String(body.fileName || 'pasted-resume.txt').slice(0, 240)
    const displayName = String(body.name || text.split('\n').find((line: string) => line.trim().length > 2)?.trim() || 'Resume import').slice(0, 300)
    const profileUrl = safeProfileUrl(body.profileUrl)
    if (text.trim().length < 20) return NextResponse.json({ ok: false, error: 'Resume text is too short to import.' }, { status: 400 })
    if (text.length > 100000) return NextResponse.json({ ok: false, error: 'Resume text exceeds the 100,000 character limit.' }, { status: 413 })

    const createdAt = nowIso()
    const sourceProfile: SourceProfileRecord = {
      id: uid('sp'),
      source: 'uploaded_resume',
      sourceProfileId: `${fileName}:${crypto.randomUUID()}`,
      profileUrl,
      displayName,
      headline: String(body.headline || 'Imported resume').slice(0, 300),
      location: String(body.location || '').slice(0, 200),
      organization: String(body.organization || '').slice(0, 200),
      rawText: text,
      status: 'pending',
      matchScore: 0,
      matchReasons: ['Created from recruiter-provided resume text'],
      lastSeenAt: createdAt,
      createdAt,
    }

    const evidence = evidenceFromText(text, 'uploaded_resume', sourceProfile.id)
    const contacts = contactsFromText(text, 'uploaded_resume', sourceProfile.id)
    const openSignals = inferOpenToWorkSignals(text, 'uploaded_resume', sourceProfile.id)
    const summary = buildCandidateSummary(sourceProfile, evidence)
    const candidate = {
      id: uid('cand'),
      ...summary,
      createdAt,
      updatedAt: createdAt,
      sourceProfileIds: [sourceProfile.id],
      evidenceItemIds: evidence.map(item => item.id),
      contactSignalIds: contacts.map(item => item.id),
      openToWorkSignalIds: openSignals.map(item => item.id),
      mergeStatus: 'pending' as const,
    }

    sourceProfile.candidateId = candidate.id
    evidence.forEach(item => { item.candidateId = candidate.id })
    contacts.forEach(item => { item.candidateId = candidate.id })
    openSignals.forEach(item => { item.candidateId = candidate.id })
    const importBatch = { id: uid('batch'), importType: 'resume_text' as const, fileName, rowsSeen: 1, recordsCreated: 1, warnings: [], createdAt }
    const snapshot: CandidateDbSnapshot = { candidates: [candidate], sourceProfiles: [sourceProfile], evidenceItems: evidence, contactSignals: contacts, openToWorkSignals: openSignals, matchReviews: [], importBatches: [importBatch] }
    const artifact = buildCandidateArtifactV36_10({
      text,
      candidateId: candidate.id,
      sourceProfileId: sourceProfile.id,
      artifactType: 'resume',
      dataOrigin: 'recruiter_upload',
      fileName,
      mimeType: String(body.mimeType || 'text/plain').slice(0, 160),
      sourceUrl: body.sourceUrl,
      observedAt: createdAt,
      metadata: {
        source: 'uploaded_resume',
        displayName,
        profileUrl: profileUrl || null,
      },
    })

    const preview = gate.preview || !isSupabaseConfigured()
    let artifactPersistence: { ok: boolean; persisted: boolean; warning?: string } = {
      ok: true,
      persisted: false,
      warning: preview ? 'Preview mode does not persist candidate artifacts.' : undefined,
    }

    if (preview) {
      const db = getCandidateDb()
      db.candidates.unshift(candidate)
      db.sourceProfiles.unshift(sourceProfile)
      db.evidenceItems.unshift(...evidence)
      db.contactSignals.unshift(...contacts)
      db.openToWorkSignals.unshift(...openSignals)
      db.importBatches.unshift(importBatch)
    } else {
      const persisted = await persistCandidateGraphSnapshot(snapshot, gate.userId)
      if (!persisted.ok) return NextResponse.json({ ok: false, error: persisted.message, details: persisted.errors || [] }, { status: 500 })
      const sb = createServerSupabaseClient()
      artifactPersistence = sb
        ? await persistCandidateArtifactV36_10({ sb, ownerId: gate.userId, artifact })
        : { ok: false, persisted: false, warning: 'Candidate artifact storage client is unavailable.' }
    }

    return NextResponse.json({
      ok: true,
      persistence_mode: preview ? 'preview' : 'supabase',
      candidate,
      sourceProfile,
      artifact,
      artifactPersistence,
      evidence,
      contacts,
      openToWorkSignals: openSignals,
      warning: artifactPersistence.warning,
    })
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Import failed' }, { status: 500 })
  }
}
