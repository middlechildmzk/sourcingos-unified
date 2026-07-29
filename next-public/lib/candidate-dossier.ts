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
  displayName?: string
  headline?: string
  location?: string
  organization?: string
  profileUrl?: string
  matchReasons?: string[]
  status?: string
}

export type CandidateDossierContact = {
  id: string
  type?: string
  value?: string
  source?: string
  confidence?: string
  permissionStatus?: string
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
  scores?: {
    bestContactScore?: number
    openToWorkScore?: number
    evidenceScore?: number
  }
  verifyNext?: string[]
  mode?: 'supabase' | 'preview'
}
