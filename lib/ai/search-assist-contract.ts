// ─────────────────────────────────────────────────────────────────────────────
// lib/ai/search-assist-contract.ts — Structured contracts for AI-assisted sourcing.
//
// These contracts define the expected shape of AI (or deterministic rule-based)
// output for each step in the sourcing workflow. Currently populated by
// deterministic rules — the same interface will be wired to Claude/OpenAI
// in Sprint 3 without changing calling code.
//
// Guardrails:
//   - No protected trait inference allowed in any contract output
//   - Clearance status is always "signal, not verified"
//   - Contact info is always "unverified"
//   - Open-to-work is always "signal, not claim"
// ─────────────────────────────────────────────────────────────────────────────

/** Output of AI-assisted query expansion for a given role/query. */
export interface QueryExpansionOutput {
  expandedTitles: string[]          // adjacent and equivalent titles
  expandedSkills: string[]          // related skills and tools
  locationVariants: string[]        // location aliases and nearby areas
  clearanceVariants?: string[]      // clearance signal expansions (never verified)
  acronyms: string[]                // known acronyms for detected terms
  likelyFalsePositives: string[]    // terms that will cause noise
  missingConstraints: string[]      // signals to add for better precision
}

/** Source strategy recommendation for a given role. */
export interface SourceStrategyOutput {
  primaryLanes: SourceLaneRecommendation[]
  secondaryLanes: SourceLaneRecommendation[]
  manualSearches: ManualSearchSuggestion[]
  note: string
}

export interface SourceLaneRecommendation {
  sourceId: string
  sourceName: string
  status: 'live' | 'preview' | 'manual-safe' | 'requires-key' | 'planned'
  rationale: string
  queryHint?: string
}

export interface ManualSearchSuggestion {
  type: 'xray' | 'boolean' | 'social'
  query: string
  description: string
}

/** Summary of a single candidate source profile. */
export interface CandidateSummaryOutput {
  displayName: string
  likelyCurrent: string            // inferred current role — NOT verified
  evidenceStrength: 'strong' | 'moderate' | 'weak'
  publicSignals: string[]          // observable public signals
  missingInfo: string[]            // what we could not determine
  verifyNext: string[]             // steps to confirm before trusting
  complianceNote: string           // always-present compliance reminder
}

/** Explanation of why two source profiles were flagged as a possible match. */
export interface MatchExplanationOutput {
  score: number                    // 0–100
  reasons: string[]
  conflicts: string[]
  recommendation: 'confirm' | 'keep-separate' | 'needs-review'
  recruiterNote: string            // human-readable summary
}

/** Project-specific fit assessment — NOT on the global candidate. */
export interface FitAssessmentOutput {
  projectId: string
  candidateId: string
  fitScore: number | null          // null = not scored yet
  fitEvidence: FitEvidenceItem[]
  fitMissing: string[]
  fitConfidence: 'high' | 'medium' | 'low'
  note: string
  guardrail: string                // always-present guardrail note
}

export interface FitEvidenceItem {
  signal: string
  met: boolean
  confidence: 'high' | 'medium' | 'low'
  source: string
}

/** HM pitch draft — NOT sent automatically. Recruiter reviews and edits. */
export interface HmPitchOutput {
  subject: string
  body: string
  keySignals: string[]
  missingToAddress: string[]
  guardrail: string               // always includes: "review before sending"
}

/** Outreach angle — NOT sent automatically. */
export interface OutreachAngleOutput {
  angle: string                   // e.g., "Mention their OSS contribution to X"
  personalization: string
  callToAction: string
  guardrail: string               // always includes contact-unverified reminder
}

// ─── Deterministic rule-based implementations ─────────────────────────────────
// These populate the contracts with rules until AI wiring lands in Sprint 3.

/** Build a query expansion from taxonomy chips (deterministic). */
export function buildQueryExpansion(
  chips: Array<{ canonical: string; type: string }>,
  expansions: Record<string, string[]>
): QueryExpansionOutput {
  const titleChips = chips.filter(c => c.type === 'title')
  const skillChips = chips.filter(c => c.type === 'skill' || c.type === 'tool')
  const locationChips = chips.filter(c => c.type === 'location')
  const clearanceChips = chips.filter(c => c.type === 'clearance')

  return {
    expandedTitles: titleChips.flatMap(c => (expansions[c.canonical.toLowerCase()] || []).slice(0, 4)),
    expandedSkills: skillChips.flatMap(c => (expansions[c.canonical.toLowerCase()] || []).slice(0, 3)),
    locationVariants: locationChips.flatMap(c => (expansions[c.canonical.toLowerCase()] || []).slice(0, 5)),
    clearanceVariants: clearanceChips.flatMap(c => (expansions[c.canonical.toLowerCase()] || []).slice(0, 4)),
    acronyms: chips.flatMap(c => {
      const exps = expansions[c.canonical.toLowerCase()] || []
      return exps.filter(e => e.length <= 6 && e === e.toUpperCase())
    }),
    likelyFalsePositives: buildFalsePositives(chips),
    missingConstraints: buildMissingConstraints(chips),
  }
}

function buildFalsePositives(chips: Array<{ canonical: string; type: string }>): string[] {
  const warnings: string[] = []
  if (chips.some(c => c.type === 'clearance')) {
    warnings.push('Public clearance mentions are unverified — do not filter on clearance from public breadcrumbs alone')
  }
  if (chips.some(c => c.canonical === 'Epic')) {
    warnings.push('"Epic" may refer to the word, not Epic Systems EMR — verify context')
  }
  if (chips.some(c => c.canonical === 'Secret' || c.canonical === 'Top Secret')) {
    warnings.push('"Secret" or "Top Secret" may appear in non-clearance contexts')
  }
  return warnings
}

function buildMissingConstraints(chips: Array<{ canonical: string; type: string }>): string[] {
  const missing: string[] = []
  if (!chips.some(c => c.type === 'location')) missing.push('Location or remote preference')
  if (!chips.some(c => c.type === 'seniority')) missing.push('Seniority level')
  if (!chips.some(c => c.type === 'skill') && !chips.some(c => c.type === 'tool')) missing.push('Technical skill or tool')
  return missing
}

/** Build a candidate summary from a source profile (deterministic). */
export function buildCandidateSummary(displayName: string, headline: string, evidence: Array<{ label: string; detail: string; confidence: string }>): CandidateSummaryOutput {
  const evidenceCount = evidence.length
  const highConf = evidence.filter(e => e.confidence === 'high').length
  const strength = highConf >= 3 ? 'strong' : highConf >= 1 || evidenceCount >= 3 ? 'moderate' : 'weak'

  return {
    displayName,
    likelyCurrent: headline || 'Unknown — not verified',
    evidenceStrength: strength,
    publicSignals: evidence.slice(0, 3).map(e => e.label),
    missingInfo: ['Current employment status', 'Contact permission', 'Clearance status (if applicable)'],
    verifyNext: [
      'Confirm current role from a primary source',
      'Do not assume contact info is verified — check before outreach',
      'Treat open-to-work signals as a starting point, not confirmation',
    ],
    complianceNote: 'Source profile only — not a confirmed candidate. Recruiter review required before any outreach.',
  }
}
