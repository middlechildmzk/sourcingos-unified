import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth-gate'
import { rateLimit } from '@/lib/rate-limit'
import { getCandidateDb } from '@/lib/candidate-db-v18'
import { getCandidateWorkspace } from '@/lib/candidate-workspace-v25'
import { isSupabaseConfigured } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

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
    return NextResponse.json({
      ok: true,
      persistence_mode: 'preview',
      candidates,
      sourceProfiles: db.sourceProfiles.filter(item => item.candidateId && candidateIds.has(item.candidateId)),
      evidenceItems: db.evidenceItems.filter(item => item.candidateId && candidateIds.has(item.candidateId)),
      contactSignals: db.contactSignals.filter(item => item.candidateId && candidateIds.has(item.candidateId)),
      openToWorkSignals: db.openToWorkSignals.filter(item => item.candidateId && candidateIds.has(item.candidateId)),
      matchReviews: db.matchReviews.filter(item => item.decision === 'pending').slice(0, 50),
      importBatches: db.importBatches.slice(0, 20),
      counts: {
        candidates: db.candidates.length,
        filteredCandidates: filtered.length,
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
