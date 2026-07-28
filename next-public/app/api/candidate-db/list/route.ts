import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth-gate'
import { rateLimit } from '@/lib/rate-limit'
import { getCandidateDb } from '@/lib/candidate-db-v18'
import { getCandidateWorkspace } from '@/lib/candidate-workspace-v25'
import { isSupabaseConfigured } from '@/lib/supabase/server'
import { resolveStoredEntityKind } from '@/lib/entity-classification'

export const dynamic = 'force-dynamic'

function parseRawText(value?: string) {
  if (!value) return undefined
  try { return JSON.parse(value) as unknown } catch { return undefined }
}

export async function GET(req: NextRequest) {
  const gate = await requireSession()
  if (!gate.ok) return gate.response
  const rl = await rateLimit(req, 'workbench', gate.userId)
  if (!rl.ok) return rl.response

  const requestedLimit = Math.max(1, Math.min(200, Number(req.nextUrl.searchParams.get('limit')) || 100))
  const offset = Math.max(0, Number(req.nextUrl.searchParams.get('offset')) || 0)
  const search = String(req.nextUrl.searchParams.get('q') || '').trim().slice(0, 100)

  if (gate.preview || !isSupabaseConfigured()) {
    const db = getCandidateDb()
    const normalizedSearch = search.toLowerCase()
    const filtered = normalizedSearch
      ? db.candidates.filter(candidate => `${candidate.canonicalName} ${candidate.headline} ${candidate.currentCompany || ''} ${candidate.location || ''} ${candidate.skills.join(' ')}`.toLowerCase().includes(normalizedSearch))
      : db.candidates
    const candidates = filtered.slice(offset, offset + requestedLimit)
    const candidateIds = new Set(candidates.map(candidate => candidate.id))
    const sourceProfiles = db.sourceProfiles.filter(item => item.candidateId && candidateIds.has(item.candidateId))
    const sourceProfilesByCandidate = new Map<string, typeof sourceProfiles>()
    for (const profile of sourceProfiles) {
      if (!profile.candidateId) continue
      const current = sourceProfilesByCandidate.get(profile.candidateId) || []
      current.push(profile)
      sourceProfilesByCandidate.set(profile.candidateId, current)
    }

    const classifiedCandidates = candidates.map(candidate => {
      const profiles = sourceProfilesByCandidate.get(candidate.id) || []
      const kinds = profiles.map(profile => resolveStoredEntityKind({
        source: profile.source,
        raw: parseRawText(profile.rawText),
      }))
      return {
        ...candidate,
        // Preview resume/CSV imports are explicit candidate imports. Search-saved
        // preview records are already limited to people by the save endpoint.
        entityKind: kinds.includes('person') || kinds.length === 0 ? 'person' : kinds[0],
      }
    })

    return NextResponse.json({
      ok: true,
      persistence_mode: 'preview',
      candidates: classifiedCandidates,
      sourceProfiles: sourceProfiles.map(profile => ({
        ...profile,
        entityKind: resolveStoredEntityKind({
          source: profile.source,
          raw: parseRawText(profile.rawText),
        }),
      })),
      evidenceItems: db.evidenceItems.filter(item => item.candidateId && candidateIds.has(item.candidateId)),
      contactSignals: db.contactSignals.filter(item => item.candidateId && candidateIds.has(item.candidateId)),
      openToWorkSignals: db.openToWorkSignals.filter(item => item.candidateId && candidateIds.has(item.candidateId)),
      matchReviews: db.matchReviews.filter(item => item.decision === 'pending').slice(0, 50),
      importBatches: db.importBatches.slice(0, 20),
      counts: {
        candidates: db.candidates.length,
        filteredCandidates: filtered.length,
        personCandidatesOnPage: classifiedCandidates.filter(candidate => candidate.entityKind === 'person').length,
        nonPersonCandidatesOnPage: classifiedCandidates.filter(candidate => candidate.entityKind !== 'person').length,
        sourceProfiles: db.sourceProfiles.length,
        evidenceItems: db.evidenceItems.length,
        contactSignals: db.contactSignals.length,
        openToWorkSignals: db.openToWorkSignals.length,
        pendingMatchReviews: db.matchReviews.filter(item => item.decision === 'pending').length,
      },
      page: { limit: requestedLimit, offset, hasMore: offset + candidates.length < filtered.length },
      search,
      _note: 'Preview mode: data resets between restarts and is not durable.',
    })
  }

  try {
    return NextResponse.json(await getCandidateWorkspace(gate.userId, { limit: requestedLimit, offset, search }))
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Could not load Candidate workspace.' }, { status: 500 })
  }
}
