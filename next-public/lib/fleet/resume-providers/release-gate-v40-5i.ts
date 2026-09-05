import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'

export const RESUME_SPRINT_PROVIDER_STRATEGY_V40_5I = 'v40_5i_provider_agnostic'
/**
 * First production canary is deliberately 6 candidates. Raising this to 12
 * (then 25/50/100) is done through RESUME_SPRINT_CANARY_CEILING in the Vercel
 * environment after each stage's telemetry has actually been reviewed.
 */
export const RESUME_SPRINT_CANARY_CEILING_DEFAULT_V40_5I = 6

export type ResumeSprintReleaseModeV40_5I = 'canary' | 'scaled'

export function resumeSprintReleaseModeV40_5I(): ResumeSprintReleaseModeV40_5I {
  return process.env.RESUME_SPRINT_RELEASE_MODE === 'scaled' ? 'scaled' : 'canary'
}

export function resumeSprintCanaryCeilingV40_5I(): number {
  const raw = Number(process.env.RESUME_SPRINT_CANARY_CEILING)
  if (Number.isFinite(raw) && raw > 0) return Math.floor(raw)
  return RESUME_SPRINT_CANARY_CEILING_DEFAULT_V40_5I
}

export type ResumeSprintReleaseGateV40_5I = {
  allowNewSearch: boolean
  mode: ResumeSprintReleaseModeV40_5I
  /** -1 when not evaluated (mode is 'scaled', or the gate query failed). */
  canariedCount: number
  ceiling: number
}

/**
 * ENFORCEMENT LIVES IN POSTGRES, NOT HERE.
 *
 * This function is REPORTING ONLY -- it populates the tick summary so an
 * operator can see the canary's state. It must never be the thing that bounds
 * the canary, because any read-then-claim performed from the application is
 * inherently racy: two overlapping cron invocations both read the same
 * headroom before either has claimed, and each admits a full canary.
 *
 * The real ceiling is enforced inside claim_resume_sprint_tasks_v40_5i, which
 * stamps admission on the task row at CLAIM time under a transaction-scoped
 * advisory lock. See the V40.5i migration and tests/sql/ for the executable
 * proof, including a concurrency case that admits 12 against a ceiling of 6
 * when the lock is removed.
 *
 * The count below therefore reads the same claim-time admission marker the
 * database uses, so what is reported matches what is enforced.
 */

/**
 * Governed release gate for the held 5,000-candidate cohort.
 *
 * The held queue has no dedicated "hold" column -- a task is simply
 * 'queued' until claimed -- and the resume-sprint cron already runs every
 * 3 minutes independent of this change. Without an explicit gate, plugging
 * in working Serper/Exa credentials would let that existing cron clear the
 * entire backlog within hours. This gate is what actually keeps the release
 * "controlled": in the default 'canary' mode, only RESUME_SPRINT_CANARY_CEILING
 * (default 12) candidates are ever allowed a NEW provider-agnostic search, no
 * matter how many times the cron fires. Already-discovered leads still
 * complete (resume_fetch_parse keeps claiming) so a canary candidate's
 * search -> parse -> attach cycle is never left half-finished.
 *
 * Raising RESUME_SPRINT_RELEASE_MODE to 'scaled' in the Vercel project's
 * environment variables is the one explicit action that lifts the hold --
 * it takes effect on the next request, no redeploy required.
 *
 * Earlier Bright-Data-only attempts (V40.5b-h) are not counted here: this
 * measures only candidates that have actually gone through the new
 * provider-agnostic pipeline, which is what "candidates canaried" means in
 * the V40.5i production report.
 */
export async function resumeSprintReleaseGateV40_5I(sb: SupabaseClient, batchTag: string): Promise<ResumeSprintReleaseGateV40_5I> {
  const mode = resumeSprintReleaseModeV40_5I()
  const ceiling = resumeSprintCanaryCeilingV40_5I()
  if (mode === 'scaled') return { allowNewSearch: true, mode, canariedCount: -1, ceiling }

  const { data, error } = await sb
    .from('candidate_enrichment_tasks')
    .select('candidate_id')
    .eq('task_kind', 'resume_search')
    .eq('payload->>batchTag', batchTag)
    // Claim-time admission marker -- the same field the database's own gate
    // counts. Counting completions instead would under-report every candidate
    // that is claimed but still running.
    .eq('payload->>v40_5i_admitted', 'true')
    .limit(Math.max(ceiling * 4, 200))

  if (error) {
    // Fail closed: if the gate itself cannot be evaluated, do not allow new
    // provider spend against additional candidates this tick.
    return { allowNewSearch: false, mode, canariedCount: -1, ceiling }
  }

  const canariedCount = new Set((data || []).map(row => row.candidate_id)).size
  return { allowNewSearch: canariedCount < ceiling, mode, canariedCount, ceiling }
}

/**
 * The V40.5i claim RPC's arguments. The ceiling and mode are passed INTO the
 * database rather than applied in the application, so that reading the current
 * admission count, deciding headroom, and stamping admission all happen inside
 * one serialized transaction.
 *
 * (The earlier application-side claim-limit clamp is deliberately gone: with
 * the ceiling enforced per task-kind in SQL, clamping the overall row limit
 * here would have throttled resume_fetch_parse draining for no safety benefit.)
 */
export function resumeSprintClaimArgsV40_5I(input: { limit: number; worker: string; now: string }) {
  const mode = resumeSprintReleaseModeV40_5I()
  return {
    p_limit: input.limit,
    p_worker: input.worker,
    p_now: input.now,
    p_canary_ceiling: resumeSprintCanaryCeilingV40_5I(),
    p_scaled: mode === 'scaled',
  }
}
