export type RecruitingRoleFamily =
  | 'recruiter'
  | 'sourcer'
  | 'technical-sourcer'
  | 'remote-recruiter'
  | 'recruiting-ops'
  | 'healthcare-recruiter'
  | 'govcon-recruiter'
  | 'ai-recruiter'
  | 'talent-intelligence'
  | 'rpo-recruiter'

export type SeniorityLevel = 'entry' | 'mid' | 'senior-ic' | 'lead' | 'manager' | 'director-plus' | 'unknown'
export type WorkModePreference = 'any' | 'remote' | 'hybrid' | 'onsite'
export type FitScoreBand = 'Strong Fit' | 'Good Fit' | 'Adjacent Fit' | 'Stretch'

export type EvidenceStatus = 'found-in-resume' | 'inferred-from-resume' | 'unverified-breadcrumb' | 'not-present'

export type MatchGroupId =
  | 'best-fits'
  | 'sourcing'
  | 'recruiting'
  | 'ops-intelligence'
  | 'federal-cleared'
  | 'rpo-contract-agency'
  | 'domain-shift-stretch'

export interface ParsedSignal {
  value: string
  evidence: string
  status: EvidenceStatus
}

export interface ClearanceSignal {
  status: EvidenceStatus
  signals: ParsedSignal[]
  note: string
}

export interface ResumeProfile {
  rawText: string
  currentTitle: string
  pastTitles: string[]
  yearsExperience: number | null
  yearsExperienceLabel: string
  seniority: SeniorityLevel
  primaryFamily: RecruitingRoleFamily
  roleFamilies: RecruitingRoleFamily[]
  specialties: string[]
  tools: string[]
  atsCrmTools: string[]
  sourcingTools: string[]
  industries: string[]
  locations: string[]
  clearance: ClearanceSignal
  profileSummary: string
  confidenceNotes: string[]
}

export interface CareerPreferences {
  desiredRoleType?: RecruitingRoleFamily | 'any'
  workMode?: WorkModePreference
  location?: string
  salaryMin?: number | null
  salaryMax?: number | null
  industryFocus?: string
  openToAdjacentRoles?: boolean
  clearedFederalInterest?: boolean
}

export interface RecruitingRoleTaxonomyEntry {
  id: RecruitingRoleFamily
  label: string
  jobSearchCategory: string
  searchTerms: string[]
  titleSignals: string[]
  skillSignals: string[]
  toolSignals: string[]
  industrySignals: string[]
  adjacentFamilies: RecruitingRoleFamily[]
  resumeAngle: string
}

export interface MatchableJob {
  id: string
  title: string
  company: string
  location: string
  remoteType?: string
  employmentType?: string
  salaryRange?: string
  source?: string
  sourceType?: string
  sourceId?: string
  applyUrl: string
  sourceUrl?: string
  postedDate?: string
  lastCheckedAt?: string
  description?: string
  tags?: string[]
  category?: string
}

export interface MatchScoreBreakdown {
  roleFamily: number
  tools: number
  industry: number
  specialty: number
  seniority: number
  preference: number
  salary: number
  clearance: number
}

export interface MatchExplanation {
  fitReasons: string[]
  potentialGaps: string[]
  resumeAngle: {
    foundInResume: string[]
    suggestedPositioning: string[]
  }
  contributingSignals: string[]
  cautionNotes: string[]
}

export interface JobMatchResult {
  job: MatchableJob
  score: number
  fitBand: FitScoreBand
  jobFamily: RecruitingRoleFamily
  scoreBreakdown: MatchScoreBreakdown
  explanation: MatchExplanation
}

export interface MatchGroup {
  id: MatchGroupId
  label: string
  description: string
  matches: JobMatchResult[]
}

export interface AdjacentRole {
  family: RecruitingRoleFamily
  label: string
  fitBand: Exclude<FitScoreBand, 'Strong Fit'>
  whyItFits: string[]
  bridgeNote: string
  searchTerms: string[]
}

export interface CareerMatchRoleUniverse {
  strongestLane: string
  alsoViable: string[]
  stretchLanes: string[]
  strongestSignals: string[]
  queryLanes: string[]
}

export interface CareerMatchDebugStats {
  queriesRun: string[]
  rawJobsFound: number
  dedupedJobs: number
  scoredJobs: number
  shownJobs: number
  rescueTierUsed: 0 | 1 | 2
}

export interface CareerMatchResponse {
  ok: true
  profile: Omit<ResumeProfile, 'rawText'>
  preferences: CareerPreferences
  matches: JobMatchResult[]
  matchGroups: MatchGroup[]
  adjacentRoles: AdjacentRole[]
  roleUniverse: CareerMatchRoleUniverse
  jobCount: number
  debug: CareerMatchDebugStats
  notes: string[]
}

export interface CareerMatchErrorResponse {
  ok: false
  code: string
  error: string
}
