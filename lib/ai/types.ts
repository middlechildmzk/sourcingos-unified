// ─────────────────────────────────────────────────────────────────────────────
// lib/ai/types.ts — Normalized AI Copilot output types.
//
// Every AI response is normalized to this envelope — never raw model output.
// Compliance invariants baked in: draft + requiresRecruiterReview always true,
// evidenceUsed + missingInfo + warnings always present.
// ─────────────────────────────────────────────────────────────────────────────

export type CopilotMode =
  | 'search_strategy' | 'candidate_summary' | 'project_fit'
  | 'hm_pitch' | 'outreach_angle' | 'verify_next' | 'search_next'

export type Confidence = 'low' | 'medium' | 'high'

/** Envelope shared by every AI Copilot output. */
export interface CopilotEnvelope {
  mode: CopilotMode
  summary: string
  evidenceUsed: string[]
  assumptions: string[]
  missingInfo: string[]
  confidence: Confidence
  warnings: string[]
  draft: true
  requiresRecruiterReview: true
  /** True when produced by the live model; false when deterministic fallback. */
  aiGenerated: boolean
  generatedAt: string
}

export interface SearchStrategyOutput extends CopilotEnvelope {
  mode: 'search_strategy'
  roleSummary: string
  searchRisks: string[]
  similarTitles: string[]
  adjacentTitles: string[]
  skillSynonyms: string[]
  sourceLanePlan: { source: string; rationale: string }[]
  firstSearchRecommendation: string
  booleanSuggestion: string
  xRaySuggestion: string
  githubQuery: string
  manualSafeWorkflow: string[]
  likelyFalsePositives: string[]
  calibrationQuestions: string[]
}

export interface CandidateSummaryOutput extends CopilotEnvelope {
  mode: 'candidate_summary'
  whyMatched: string[]
  evidenceBullets: string[]
  riskFlags: string[]
  verifyNext: string[]
  shouldReview: boolean
}

export interface ProjectFitOutput extends CopilotEnvelope {
  mode: 'project_fit'
  fitScore: number            // 0–100, project-specific (never global)
  mustHaveMatch: number
  technicalFit: number
  domainFit: number
  seniorityFit: number
  locationFit: number
  evidenceQuality: number
  outreachPriority: number
  explanation: string
  verificationNeeded: string[]
}

export interface HmPitchOutput extends CopilotEnvelope {
  mode: 'hm_pitch'
  pitch: string
  strongestEvidence: string[]
  caveats: string[]
}

export interface OutreachAngleOutput extends CopilotEnvelope {
  mode: 'outreach_angle'
  linkedinOpener: string
  emailOpener: string
  personalizationPoints: string[]
  doNotUseClaims: string[]
}

export interface VerifyNextOutput extends CopilotEnvelope {
  mode: 'verify_next'
  items: string[]
}

export interface SearchNextOutput extends CopilotEnvelope {
  mode: 'search_next'
  moves: { label: string; query: string; reason: string }[]
}

/** Saved AI note — schema-ready for a future Supabase `ai_notes` table. */
export interface SavedAiNote {
  id: string
  mode: CopilotMode
  content: string
  evidenceUsed: string[]
  userId?: string
  projectId?: string
  candidateId?: string
  sourceProfileId?: string
  draft: true
  generatedAt: string
}

/** Inputs commonly passed to copilot functions. */
export interface CopilotCandidateInput {
  displayName?: string
  headline?: string
  source?: string
  organization?: string
  location?: string
  profileUrl?: string
  matchedSkills?: string[]
  evidenceSnippets?: string[]
  contactSignalCount?: number
}

export interface CopilotProjectMemory {
  preferredSkills?: string[]
  rejectedSkills?: string[]
  preferredTitles?: string[]
  rejectedTitles?: string[]
  positivePatterns?: string[]
  negativePatterns?: string[]
  cautionPatterns?: string[]
  falsePositiveCount?: number
}

export interface CopilotPlanInput {
  roleTitle?: string
  rawQuery?: string
  mustHaveSkills?: string[]
  niceToHaveSkills?: string[]
  location?: string
  manualSafeConstraints?: string[]
  exclusions?: string[]
  sourceLanes?: string[]
  /** Local, project-scoped recruiter feedback. Never used to train external models. */
  projectMemory?: CopilotProjectMemory
}
