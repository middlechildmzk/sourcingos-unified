import type { Candidate360ResolvedProfileV35 } from './candidate-field-resolution-v35'

export type CandidateDossierCandidate = {
  id?: string
  canonicalName?: string
  headline?: string
  currentCompany?: string
  currentTitle?: string
  location?: string
  summary?: string
  skills?: string[]
  mergeStatus?: string
  lastRefreshedAt?: string
  createdAt?: string
  updatedAt?: string
}

export type CandidateDossierEvidence = {
  id: string
  source?: string
  label?: string
  detail?: string
  confidence?: string
  url?: string
}

export type CandidateDossierProfile = {
  id: string
  source?: string
  sourceProfileId?: string
  displayName?: string
  headline?: string
  location?: string
  organization?: string
  profileUrl?: string
  matchReasons?: string[]
  status?: string
  lastSeenAt?: string
}

export type CandidateDossierContact = {
  id: string
  type?: string
  contactKind?: string
  value?: string
  source?: string
  confidence?: string
  ownershipConfidence?: string
  deliverability?: string
  providerStatusRaw?: string
  permissionStatus?: string
  observedAt?: string
  score?: number
}

export type CandidateDossierAvailability = {
  id: string
  label?: string
  detail?: string
  score?: number
}

export type CandidateDossierMatchReview = {
  id: string
  decision?: string
  score?: number
  reasons?: string[]
}

export type CandidateDossier = {
  candidate: CandidateDossierCandidate
  resolvedProfile?: Candidate360ResolvedProfileV35
  evidence?: CandidateDossierEvidence[]
  sourceProfiles?: CandidateDossierProfile[]
  contacts?: CandidateDossierContact[]
  openToWorkSignals?: CandidateDossierAvailability[]
  matchReviews?: CandidateDossierMatchReview[]
  projectCandidates?: unknown[]
  freshness?: {
    days?: number
    label?: string
  }
  verifyNext?: string[]
  mode?: 'supabase' | 'preview'
}
