// ─────────────────────────────────────────────────────────────────────────────
// /api/candidates/save - V29.2.1 identity trust boundary.
//
// Before V29.2.1 this route accepted `z.array(z.any())` and persisted a
// client-authored candidate graph verbatim. That allowed a manipulated client
// to submit its own source-profile grouping, relabel a publication or package
// as a person, inject query-derived skills, and promote a profile URL into a
// contact signal.
//
// The route now treats the body as untrusted: it validates shape, discards any
// client-submitted grouping, re-derives subject kind and skill/contact hygiene
// through the V29.2 sanitizer, rejects everything that is not a person anchor,
// and builds the candidate draft server-side.
//
// Persistence remains the preview-only in-memory adapter. It is not the
// canonical Supabase candidate graph and is labelled as such in the response.
// ─────────────────────────────────────────────────────────────────────────────
import { NextResponse } from 'next/server'
import { rateLimit } from '@/lib/rate-limit'
import { requireSession } from '@/lib/auth-gate'
import { saveCandidateGraph } from '@/lib/candidate-store'
import { buildIdentityResolutionDraft } from '@/lib/candidate-graph'
import { classifySourceResult, isGeneratedDemoResult } from '@/lib/entity-classification'
import { candidateSaveRequestSchema, flattenSaveRequest } from '@/lib/source-result-contract'
import type { SourceResult } from '@/lib/source-types'

type RejectedResult = {
  id: string
  source: string
  entityKind: string
  reason: string
}

export async function POST(req: Request) {
  const gate = await requireSession()
  if (!gate.ok) return gate.response
  const rl = await rateLimit(req, 'workbench', gate.userId)
  if (!rl.ok) return rl.response

  try {
    const body = candidateSaveRequestSchema.parse(await req.json())
    const { results, discardedClientGroupings } = flattenSaveRequest(body)

    const submittedCount = results.length
    const rejected: RejectedResult[] = []
    const accepted: SourceResult[] = []

    for (const submitted of results) {
      const result = submitted as SourceResult

      if (isGeneratedDemoResult(result)) {
        rejected.push({
          id: result.id,
          source: result.source,
          entityKind: 'unknown',
          reason: 'Generated demo result. Demo content cannot be saved as a candidate.',
        })
        continue
      }

      // Subject kind is re-derived from source and raw evidence. A client-supplied
      // entityKind is never trusted.
      accepted.push(classifySourceResult(result))
    }

    // Person-anchor filtering, skill hygiene, contact hygiene and candidate
    // drafting all happen here, server-side.
    const draft = buildIdentityResolutionDraft(accepted)

    for (const item of draft.excluded) {
      rejected.push({
        id: item.id,
        source: item.source,
        entityKind: item.entityKind,
        reason: item.reason,
      })
    }

    if (!draft.candidates.length) {
      return NextResponse.json({
        ok: false,
        mode: 'preview',
        error: 'No person anchors in this submission. Publications, packages, repositories, organizations, discovery lanes and unresolved identities cannot be saved as candidates.',
        submittedCount,
        savedCount: 0,
        rejected,
      }, { status: 422 })
    }

    const candidates = saveCandidateGraph(draft.candidates)

    return NextResponse.json({
      ok: true,
      mode: 'preview',
      candidates,
      savedCount: draft.candidates.length,
      submittedCount,
      rejected,
      identityProposals: draft.proposals,
      duplicatesCollapsed: draft.duplicatesCollapsed,
      discardedClientGroupings,
      resolverVersion: draft.resolverVersion,
      guardrails: [
        'Each saved record holds exactly one source profile. No cross-source linkage was applied.',
        'Resemblance between records is reported as a pending proposal and requires recruiter approval.',
        'Subject kind, skills and contact signals were re-derived server-side from source evidence.',
        'Preview persistence uses an in-memory adapter. Saved work does not survive a restart and is not the canonical Supabase candidate graph.',
      ],
    })
  } catch (error) {
    return NextResponse.json({
      ok: false,
      error: error instanceof Error ? error.message : 'Save failed',
    }, { status: 400 })
  }
}
