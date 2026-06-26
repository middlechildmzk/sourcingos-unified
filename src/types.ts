export type SourcingMode =
  | 'Cleared / GovCon'
  | 'Cybersecurity'
  | 'Cloud / DevSecOps'
  | 'Software Engineering'
  | 'AI / ML'
  | 'Data Engineering'
  | 'Healthcare IT'
  | 'General Technical';

export type ConnectorStatus = 'connected' | 'live_ready' | 'manual_only' | 'planned' | 'blocked' | 'evidence_only';
export type CandidateStage = 'new' | 'reviewed' | 'saved' | 'screen' | 'submitted' | 'rejected';
export type ConfidenceLabel = 'low' | 'medium' | 'high';
export type VerificationStatus = 'not_verified' | 'recruiter_verified' | 'conflict' | 'needs_review';
export type SourceProfileStatus = 'linked' | 'needs_review' | 'rejected';
export type SourceName =
  | 'github'
  | 'stackoverflow'
  | 'openalex'
  | 'huggingface'
  | 'npm'
  | 'pypi'
  | 'dockerhub'
  | 'orcid'
  | 'semantic_scholar'
  | 'dblp'
  | 'crossref'
  | 'arxiv'
  | 'nvd'
  | 'cisa_kev'
  | 'npi'
  | 'clinicaltrials'
  | 'pubmed'
  | 'nih_reporter'
  | 'manual_demo'
  | 'manual';

export interface ClearanceSignal {
  level: 'public_trust' | 'secret' | 'top_secret' | 'ts_sci' | 'polygraph' | 'unknown';
  phrase: string;
  caution: string;
  confidence: number;
  sourceText: string;
}

export interface ParsedRoleField { label: string; value: string; confidence: number; }
export interface PoolEstimate {
  estimatedPool: string;
  githubRepoSignal: string;
  stackOverflowSignal: string;
  difficulty: number;
  difficultyLabel: 'Easy' | 'Moderate' | 'Hard' | 'Very Hard';
  rationale: string[];
  expansionSuggestions: string[];
  riskFlags: string[];
}
export interface SearchLane {
  id: string;
  name: string;
  bestSource: string;
  goal: string;
  query: string;
  expectedYield: string;
  noiseLevel: 'low' | 'medium' | 'high';
  falsePositiveWarnings: string[];
}
export interface RoleAnalysis {
  id: string;
  roleTitle: string;
  mode: SourcingMode;
  summary: string;
  parsedFields: ParsedRoleField[];
  mustHaves: string[];
  niceToHaves: string[];
  disqualifiers: string[];
  targetTitles: string[];
  adjacentTitles: string[];
  keywords: string[];
  filters: string[];
  targetCompanies: string[];
  locations: string[];
  clearanceSignals: ClearanceSignal[];
  poolEstimate: PoolEstimate;
  booleanStrings: string[];
  xrayStrings: string[];
  searchLanes: SearchLane[];
  sourceQueries: { githubRepoQuery: string; stackOverflowTags: string[]; openAlexQuery: string; packageQuery: string; };
}

export interface RepoHighlight { name: string; url: string; description: string; language: string; stars: number; forks: number; topics: string[]; updatedAt: string; }
export interface EvidenceItem { id: string; label: string; detail: string; source: SourceName | 'manual'; url?: string; confidence: number; createdAt?: string; }
export interface SourceProfile {
  id: string;
  candidateId: string;
  source: SourceName;
  url: string;
  username?: string;
  displayName?: string;
  headline?: string;
  location?: string;
  publicEmail?: string;
  website?: string;
  avatarUrl?: string;
  rawSummary: string;
  fetchedAt: string;
  confidence: ConfidenceLabel;
  status: SourceProfileStatus;
}
export interface ContactSignal {
  id: string;
  candidateId: string;
  type: 'email' | 'website' | 'github' | 'stackoverflow' | 'openalex' | 'linkedin_manual' | 'x_twitter' | 'portfolio' | 'orcid' | 'package' | 'other';
  value: string;
  source: SourceName | 'manual';
  confidence: ConfidenceLabel;
  verificationStatus: VerificationStatus;
  riskNote: string;
}
export interface IdentityMergeSuggestion {
  candidateId: string;
  confidence: number;
  confidenceLabel: ConfidenceLabel;
  reasons: string[];
  conflicts: string[];
  recommendation: 'confirm_link' | 'review_side_by_side' | 'keep_separate';
  status: 'suggested' | 'confirmed' | 'rejected';
}
export interface EvidenceMatrixRow { skill: string; evidence: string; source: SourceName | 'manual'; confidence: ConfidenceLabel; recency: string; url?: string; }
export interface CandidateSynthesis {
  facts: string[];
  inferences: string[];
  conflicts: string[];
  hmPitch: string;
  outreachAngle: string;
  verifyNext: string[];
  generatedAt: string;
  mode: 'local_rule_based' | 'llm_prompt_ready';
}
export interface SourcedCandidate {
  id: string;
  name: string;
  username: string;
  source: SourceName;
  profileUrl: string;
  headline: string;
  company: string;
  location: string;
  avatarUrl?: string;
  fitScore: number;
  sourceConfidence: number;
  technicalDepthScore: number;
  contactabilityScore: number;
  profileCompleteness: number;
  matchedSkills: string[];
  missingSignals: string[];
  evidence: EvidenceItem[];
  repoHighlights: RepoHighlight[];
  stackOverflow?: { reputation: number; badges: string; topTags: Array<{ name: string; count: number }>; };
  guardrails: string[];
  stage: CandidateStage;
  sourceProfiles: SourceProfile[];
  contactSignals: ContactSignal[];
  identityMergeSuggestion?: IdentityMergeSuggestion;
  evidenceMatrix: EvidenceMatrixRow[];
  synthesis?: CandidateSynthesis;
  lastRediscoveredAt?: string;
  demoOnly?: boolean;
}
export interface SourceRun {
  id: string;
  status: 'idle' | 'running' | 'complete' | 'error';
  startedAt: string;
  completedAt?: string;
  roleId: string;
  sources: SourceName[];
  querySummary: string;
  notes: string[];
  errors: string[];
  resultCount: number;
}
export interface Connector { id: string; name: string; status: ConnectorStatus; category: string; safeUse: string; guardrail: string; source: SourceName | 'manual'; priority: 'P0' | 'P1' | 'P2' | 'manual'; }
export interface PipelineEntry { id: string; candidateId: string; stage: CandidateStage; notes: string; updatedAt: string; }
export interface FeedbackEvent { id: string; candidateId: string; label: 'strong_fit' | 'good_fit' | 'maybe' | 'bad_fit' | 'too_junior' | 'too_senior' | 'wrong_location' | 'wrong_domain' | 'wrong_clearance' | 'great_signal'; note: string; createdAt: string; }
export interface ProjectMemory {
  positivePatterns: string[];
  negativePatterns: string[];
  cautionPatterns: string[];
  rediscoveryNotes: string[];
  updatedAt: string;
}
export interface AISettings { provider: 'local_only' | 'openai_prompt_ready' | 'claude_prompt_ready'; apiKeyStored: boolean; privacyMode: 'strict_local' | 'byok_review_required'; }
