// ─────────────────────────────────────────────────────────────────────────────
// lib/ai/sourcing-copilot.ts — SERVER-ONLY orchestration.
//
// Each function tries the live model, then falls back to deterministic output
// built from the existing parser/query-builder logic. Either way the result is
// normalized to the CopilotEnvelope with draft + requiresRecruiterReview = true.
// ─────────────────────────────────────────────────────────────────────────────
import 'server-only'
import { callModelJson } from './provider'
import {
  STRATEGY_PROMPT, CANDIDATE_SUMMARY_PROMPT, PROJECT_FIT_PROMPT,
  HM_PITCH_PROMPT, OUTREACH_ANGLE_PROMPT, SEARCH_NEXT_PROMPT,
} from './prompts'
import {
  SearchStrategyOutput, CandidateSummaryOutput, ProjectFitOutput,
  HmPitchOutput, OutreachAngleOutput, VerifyNextOutput, SearchNextOutput,
  CopilotCandidateInput, CopilotPlanInput, Confidence,
} from './types'

const now = () => new Date().toISOString()
const base = (aiGenerated: boolean) => ({
  draft: true as const, requiresRecruiterReview: true as const, aiGenerated, generatedAt: now(),
})
const conf = (c: unknown): Confidence => (c === 'high' || c === 'medium' || c === 'low' ? c : 'low')
const arr = (v: unknown): string[] => (Array.isArray(v) ? v.filter(x => typeof x === 'string') : [])
const num = (v: unknown): number => (typeof v === 'number' && isFinite(v) ? Math.max(0, Math.min(100, Math.round(v))) : 0)

const COMPLIANCE_WARNINGS = [
  'AI draft — review before using.',
  'Clearance, contact, and open-to-work are never verified by AI.',
  'Based only on visible public evidence.',
]

// ── Search strategy ────────────────────────────────────────────────────────────
export async function generateSearchStrategy(plan: CopilotPlanInput): Promise<SearchStrategyOutput> {
  const planJson = JSON.stringify(plan)
  const r = await callModelJson<Record<string, unknown>>(STRATEGY_PROMPT(planJson))
  if (r.ok && r.data) {
    const d = r.data
    return {
      mode: 'search_strategy', ...base(true),
      summary: String(d.roleSummary || 'AI search strategy draft.'),
      roleSummary: String(d.roleSummary || ''),
      searchRisks: arr(d.searchRisks), similarTitles: arr(d.similarTitles),
      adjacentTitles: arr(d.adjacentTitles), skillSynonyms: arr(d.skillSynonyms),
      sourceLanePlan: Array.isArray(d.sourceLanePlan) ? (d.sourceLanePlan as { source: string; rationale: string }[]) : [],
      firstSearchRecommendation: String(d.firstSearchRecommendation || ''),
      booleanSuggestion: String(d.booleanSuggestion || ''),
      xRaySuggestion: String(d.xRaySuggestion || ''),
      githubQuery: String(d.githubQuery || ''),
      manualSafeWorkflow: arr(d.manualSafeWorkflow), likelyFalsePositives: arr(d.likelyFalsePositives),
      calibrationQuestions: arr(d.calibrationQuestions),
      evidenceUsed: arr(d.evidenceUsed), assumptions: arr(d.assumptions),
      missingInfo: arr(d.missingInfo), confidence: conf(d.confidence),
      warnings: COMPLIANCE_WARNINGS,
    }
  }
  // Deterministic fallback
  const skills = plan.mustHaveSkills || []
  return {
    mode: 'search_strategy', ...base(false),
    summary: `Deterministic plan for ${plan.roleTitle || 'role'} — skill-first public search.`,
    roleSummary: `${plan.roleTitle || 'Role'} — drive public search from must-have skills.`,
    searchRisks: plan.manualSafeConstraints?.length ? ['Clearance not visible on public sources — confirm manually.'] : [],
    similarTitles: [], adjacentTitles: [], skillSynonyms: skills,
    sourceLanePlan: (plan.sourceLanes || ['github']).map(s => ({ source: s, rationale: 'Recommended by deterministic routing.' })),
    firstSearchRecommendation: skills.slice(0, 4).join(' '),
    booleanSuggestion: skills.map(s => `"${s}"`).join(' AND '),
    xRaySuggestion: `site:github.com ${skills.slice(0, 3).join(' ')}`,
    githubQuery: skills.slice(0, 4).join(' '),
    manualSafeWorkflow: plan.manualSafeConstraints?.length ? ['Use ClearanceJobs / LinkedIn Recruiter workflow for clearance verification.'] : [],
    likelyFalsePositives: plan.exclusions || [],
    calibrationQuestions: ['What are the true non-negotiables vs nice-to-haves?', 'Is the clearance active and required day one?'],
    evidenceUsed: [], assumptions: ['Deterministic fallback — no AI key configured.'],
    missingInfo: ['AI provider not configured.'], confidence: 'low',
    warnings: ['AI Copilot not configured — showing deterministic strategy.', ...COMPLIANCE_WARNINGS],
  }
}

// ── Candidate summary ───────────────────────────────────────────────────────────
export async function generateCandidateSummary(candidate: CopilotCandidateInput, plan: CopilotPlanInput): Promise<CandidateSummaryOutput> {
  const r = await callModelJson<Record<string, unknown>>(CANDIDATE_SUMMARY_PROMPT(JSON.stringify(candidate), JSON.stringify(plan)))
  if (r.ok && r.data) {
    const d = r.data
    return {
      mode: 'candidate_summary', ...base(true),
      summary: String(d.summary || ''), whyMatched: arr(d.whyMatched),
      evidenceBullets: arr(d.evidenceBullets), riskFlags: arr(d.riskFlags),
      verifyNext: arr(d.verifyNext), shouldReview: d.shouldReview !== false,
      evidenceUsed: arr(d.evidenceUsed), assumptions: arr(d.assumptions),
      missingInfo: arr(d.missingInfo), confidence: conf(d.confidence),
      warnings: COMPLIANCE_WARNINGS,
    }
  }
  const matched = candidate.matchedSkills || []
  return {
    mode: 'candidate_summary', ...base(false),
    summary: `${candidate.displayName || 'This source profile'} shows public evidence of ${matched.slice(0, 3).join(', ') || 'relevant work'} via ${candidate.source || 'a public source'}. Identity and current role are not verified.`,
    whyMatched: matched.slice(0, 5).map(s => `Public evidence of ${s}`),
    evidenceBullets: (candidate.evidenceSnippets || []).slice(0, 4),
    riskFlags: [], verifyNext: ['Confirm current title/employer', 'Confirm skills from primary evidence'],
    shouldReview: matched.length > 0,
    evidenceUsed: matched, assumptions: ['Deterministic fallback — no AI key configured.'],
    missingInfo: candidate.location ? [] : ['Location not present'], confidence: 'low',
    warnings: ['AI Copilot not configured — showing deterministic summary.', ...COMPLIANCE_WARNINGS],
  }
}

// ── Project fit ──────────────────────────────────────────────────────────────────
export async function generateProjectFit(candidate: CopilotCandidateInput, plan: CopilotPlanInput): Promise<ProjectFitOutput> {
  const r = await callModelJson<Record<string, unknown>>(PROJECT_FIT_PROMPT(JSON.stringify(candidate), JSON.stringify(plan)))
  if (r.ok && r.data) {
    const d = r.data
    return {
      mode: 'project_fit', ...base(true),
      summary: String(d.explanation || 'AI project-fit draft.'),
      fitScore: num(d.fitScore), mustHaveMatch: num(d.mustHaveMatch), technicalFit: num(d.technicalFit),
      domainFit: num(d.domainFit), seniorityFit: num(d.seniorityFit), locationFit: num(d.locationFit),
      evidenceQuality: num(d.evidenceQuality), outreachPriority: num(d.outreachPriority),
      explanation: String(d.explanation || ''), verificationNeeded: arr(d.verificationNeeded),
      evidenceUsed: arr(d.evidenceUsed), assumptions: arr(d.assumptions),
      missingInfo: arr(d.missingInfo), confidence: conf(d.confidence),
      warnings: COMPLIANCE_WARNINGS,
    }
  }
  // Deterministic fallback: rough must-have overlap
  const must = plan.mustHaveSkills || []
  const matched = candidate.matchedSkills || []
  const overlap = must.length ? Math.round((matched.filter(s => must.includes(s)).length / must.length) * 100) : 50
  const evidenceQ = Math.min(100, (candidate.evidenceSnippets?.length || 0) * 25)
  const fit = Math.round(overlap * 0.30 + overlap * 0.20 + 50 * 0.15 + 50 * 0.10 + (candidate.location ? 60 : 30) * 0.08 + evidenceQ * 0.10 + 50 * 0.07)
  return {
    mode: 'project_fit', ...base(false),
    summary: `Deterministic project-fit estimate from must-have skill overlap (${overlap}%).`,
    fitScore: fit, mustHaveMatch: overlap, technicalFit: overlap, domainFit: 50, seniorityFit: 50,
    locationFit: candidate.location ? 60 : 30, evidenceQuality: evidenceQ, outreachPriority: 50,
    explanation: `Estimated from ${matched.length} matched skill(s) against ${must.length} must-have(s). Needs recruiter review.`,
    verificationNeeded: ['Confirm must-have skills from primary evidence', 'Confirm seniority and location'],
    evidenceUsed: matched, assumptions: ['Deterministic fallback — no AI key configured.'],
    missingInfo: ['AI provider not configured.'], confidence: 'low',
    warnings: ['AI Copilot not configured — deterministic estimate.', ...COMPLIANCE_WARNINGS],
  }
}

// ── HM pitch ─────────────────────────────────────────────────────────────────────
export async function generateHmPitch(candidate: CopilotCandidateInput, plan: CopilotPlanInput): Promise<HmPitchOutput> {
  const r = await callModelJson<Record<string, unknown>>(HM_PITCH_PROMPT(JSON.stringify(candidate), JSON.stringify(plan)))
  if (r.ok && r.data) {
    const d = r.data
    return {
      mode: 'hm_pitch', ...base(true),
      summary: String(d.summary || 'HM pitch draft.'), pitch: String(d.pitch || ''),
      strongestEvidence: arr(d.strongestEvidence), caveats: arr(d.caveats),
      evidenceUsed: arr(d.evidenceUsed), assumptions: arr(d.assumptions),
      missingInfo: arr(d.missingInfo), confidence: conf(d.confidence),
      warnings: COMPLIANCE_WARNINGS,
    }
  }
  const matched = candidate.matchedSkills || []
  return {
    mode: 'hm_pitch', ...base(false),
    summary: 'Deterministic HM pitch draft.',
    pitch: `Worth a look based on public technical evidence: ${candidate.displayName || 'this profile'} shows ${matched.slice(0, 3).join(', ') || 'relevant'} work through ${candidate.source || 'public sources'}. Clearance and current availability are not verified and would need manual confirmation. Draft — review before sending.`,
    strongestEvidence: matched.slice(0, 3).map(s => `Public evidence of ${s}`),
    caveats: ['Identity not confirmed', 'Clearance/availability not verified'],
    evidenceUsed: matched, assumptions: ['Deterministic fallback — no AI key configured.'],
    missingInfo: ['AI provider not configured.'], confidence: 'low',
    warnings: ['AI Copilot not configured — deterministic pitch.', ...COMPLIANCE_WARNINGS],
  }
}

// ── Outreach angle ───────────────────────────────────────────────────────────────
export async function generateOutreachAngle(candidate: CopilotCandidateInput, plan: CopilotPlanInput): Promise<OutreachAngleOutput> {
  const r = await callModelJson<Record<string, unknown>>(OUTREACH_ANGLE_PROMPT(JSON.stringify(candidate), JSON.stringify(plan)))
  if (r.ok && r.data) {
    const d = r.data
    return {
      mode: 'outreach_angle', ...base(true),
      summary: String(d.summary || 'Outreach angle draft.'),
      linkedinOpener: String(d.linkedinOpener || ''), emailOpener: String(d.emailOpener || ''),
      personalizationPoints: arr(d.personalizationPoints), doNotUseClaims: arr(d.doNotUseClaims),
      evidenceUsed: arr(d.evidenceUsed), assumptions: arr(d.assumptions),
      missingInfo: arr(d.missingInfo), confidence: conf(d.confidence),
      warnings: COMPLIANCE_WARNINGS,
    }
  }
  const matched = candidate.matchedSkills || []
  const role = plan.roleTitle || 'a role'
  return {
    mode: 'outreach_angle', ...base(false),
    summary: 'Deterministic outreach angle draft.',
    linkedinOpener: `Hi ${candidate.displayName || 'there'} — came across your public ${matched[0] || 'engineering'} work and thought of ${role}. Open to a quick chat?`,
    emailOpener: `Your public work on ${matched.slice(0, 2).join(' and ') || 'your projects'} caught my eye in the context of ${role}. Would you be open to learning more?`,
    personalizationPoints: matched.slice(0, 3).map(s => `Reference their ${s} work`),
    doNotUseClaims: ['Do not claim you know they are looking', 'Do not claim verified clearance'],
    evidenceUsed: matched, assumptions: ['Deterministic fallback — no AI key configured.'],
    missingInfo: ['AI provider not configured.'], confidence: 'low',
    warnings: ['AI Copilot not configured — deterministic angle.', ...COMPLIANCE_WARNINGS],
  }
}

// ── Verify-next (always deterministic — cheap, no model needed) ──────────────────
export function generateVerifyNext(candidate: CopilotCandidateInput, plan: CopilotPlanInput): VerifyNextOutput {
  const items = [
    'Confirm current title and employer from a primary source',
    'Confirm location and remote eligibility',
    'Confirm must-have skills from primary evidence',
  ]
  if (plan.manualSafeConstraints?.length) items.push('Confirm clearance manually through approved channels')
  items.push('Verify any contact info before outreach', 'Review identity match before merging with an existing candidate')
  if (candidate.contactSignalCount === 0) items.push('No contact signal found — add company/domain to improve enrichment')
  items.push('Check evidence recency/freshness', 'Review open-to-work signal before assuming availability')
  return {
    mode: 'verify_next', ...base(false),
    summary: 'Verify-next checklist.', items,
    evidenceUsed: candidate.matchedSkills || [], assumptions: [], missingInfo: [],
    confidence: 'high', warnings: ['Checklist — confirm each item before acting.'],
  }
}

// ── Search-next ──────────────────────────────────────────────────────────────────
export async function generateSearchNext(context: Record<string, unknown>): Promise<SearchNextOutput> {
  const r = await callModelJson<Record<string, unknown>>(SEARCH_NEXT_PROMPT(JSON.stringify(context)))
  if (r.ok && r.data) {
    const d = r.data
    return {
      mode: 'search_next', ...base(true),
      summary: String(d.summary || 'Next search moves.'),
      moves: Array.isArray(d.moves) ? (d.moves as { label: string; query: string; reason: string }[]) : [],
      evidenceUsed: arr(d.evidenceUsed), assumptions: arr(d.assumptions),
      missingInfo: arr(d.missingInfo), confidence: conf(d.confidence),
      warnings: COMPLIANCE_WARNINGS,
    }
  }
  const skills = (context.mustHaveSkills as string[]) || []
  const hasClearance = Boolean((context.manualSafeConstraints as string[])?.length)
  const moves = [
    { label: 'Skill-first retry', query: skills.slice(0, 4).join(' '), reason: 'Public sources respond best to skill terms.' },
    { label: 'Remove location', query: skills.slice(0, 3).join(' '), reason: 'Location data is sparse on public technical sources.' },
  ]
  if (hasClearance) moves.push({ label: 'Manual-safe clearance lane', query: 'ClearanceJobs / LinkedIn Recruiter workflow', reason: 'Clearance is not visible on public APIs.' })
  return {
    mode: 'search_next', ...base(false),
    summary: 'Deterministic next-move suggestions.', moves,
    evidenceUsed: [], assumptions: ['Deterministic fallback — no AI key configured.'],
    missingInfo: ['AI provider not configured.'], confidence: 'low',
    warnings: ['AI Copilot not configured — deterministic suggestions.'],
  }
}
