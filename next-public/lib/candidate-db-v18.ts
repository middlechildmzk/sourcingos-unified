export type CandidateSourceName =
  | 'github'
  | 'stackoverflow'
  | 'openalex'
  | 'orcid'
  | 'semantic_scholar'
  | 'arxiv'
  | 'pubmed'
  | 'huggingface'
  | 'npm'
  | 'pypi'
  | 'kaggle'
  | 'dev'
  | 'dockerhub'
  | 'crates'
  | 'rubygems'
  | 'resume_xray'
  | 'public_resume'
  | 'uploaded_resume'
  | 'csv_import'
  | 'manual'

export type EvidenceConfidence = 'low' | 'medium' | 'high'
export type MatchDecision = 'pending' | 'confirmed' | 'rejected'
export type ContactType = 'email' | 'phone' | 'website' | 'linkedin' | 'github' | 'portfolio' | 'other'

export type CandidateRecord = {
  id: string
  canonicalName: string
  headline: string
  location?: string
  currentCompany?: string
  currentTitle?: string
  summary: string
  skills: string[]
  createdAt: string
  updatedAt: string
  lastRefreshedAt?: string
  sourceProfileIds: string[]
  evidenceItemIds: string[]
  contactSignalIds: string[]
  openToWorkSignalIds: string[]
  mergeStatus: MatchDecision
}

export type SourceProfileRecord = {
  id: string
  candidateId?: string
  source: CandidateSourceName
  sourceProfileId: string
  profileUrl?: string
  displayName: string
  headline?: string
  location?: string
  organization?: string
  rawText?: string
  raw?: unknown
  status: MatchDecision
  matchScore: number
  matchReasons: string[]
  lastSeenAt: string
  createdAt: string
}

export type EvidenceItemRecord = {
  id: string
  candidateId?: string
  sourceProfileId?: string
  source: CandidateSourceName
  label: string
  detail: string
  confidence: EvidenceConfidence
  url?: string
  createdAt: string
}

export type CandidateContactSignal = {
  id: string
  candidateId?: string
  sourceProfileId?: string
  type: ContactType
  value: string
  source: CandidateSourceName
  confidence: EvidenceConfidence
  verified: false
  permissionStatus: 'unknown' | 'candidate_provided' | 'company_owned' | 'do_not_contact'
  createdAt: string
}

export type OpenToWorkSignal = {
  id: string
  candidateId?: string
  sourceProfileId?: string
  source: CandidateSourceName
  label: string
  detail: string
  confidence: EvidenceConfidence
  requiresReview: boolean
  createdAt: string
}

export type IdentityMatchReview = {
  id: string
  candidateId?: string
  sourceProfileIds: string[]
  proposedCanonicalName: string
  score: number
  reasons: string[]
  conflicts: string[]
  decision: MatchDecision
  decidedBy?: string
  decidedAt?: string
  createdAt: string
}

export type CandidateImportBatch = {
  id: string
  importType: 'resume_text' | 'csv' | 'manual_source_profile'
  fileName?: string
  rowsSeen: number
  recordsCreated: number
  warnings: string[]
  createdAt: string
}

export type CandidateDbSnapshot = {
  candidates: CandidateRecord[]
  sourceProfiles: SourceProfileRecord[]
  evidenceItems: EvidenceItemRecord[]
  contactSignals: CandidateContactSignal[]
  openToWorkSignals: OpenToWorkSignal[]
  matchReviews: IdentityMatchReview[]
  importBatches: CandidateImportBatch[]
}

export function nowIso() { return new Date().toISOString() }
export function uid(_prefix: string): string {
  // crypto.randomUUID() is globally available in Node 18+ / Next.js 14.
  // All V19 Supabase tables use `id uuid primary key` — non-UUID strings like
  // "sp_1748455200_abc" fail with: invalid input syntax for type uuid.
  return crypto.randomUUID()
}

const globalForCandidateDb = globalThis as unknown as { __sourcingosCandidateDb?: CandidateDbSnapshot }

export function getCandidateDb(): CandidateDbSnapshot {
  if (!globalForCandidateDb.__sourcingosCandidateDb) {
    globalForCandidateDb.__sourcingosCandidateDb = {
      candidates: [],
      sourceProfiles: [],
      evidenceItems: [],
      contactSignals: [],
      openToWorkSignals: [],
      matchReviews: [],
      importBatches: []
    }
  }
  return globalForCandidateDb.__sourcingosCandidateDb
}

export function resetCandidateDb() {
  globalForCandidateDb.__sourcingosCandidateDb = undefined
  return getCandidateDb()
}

export function normalizeWhitespace(value = '') {
  return value.replace(/\s+/g, ' ').trim()
}

export function splitSkills(value = '') {
  const skillHints = ['typescript','javascript','react','node','python','java','go','rust','aws','azure','gcp','kubernetes','terraform','linux','security','devsecops','fedramp','govcloud','rmf','nist','ai','machine learning','llm','nlp','data science','pytorch','tensorflow','nursing','rn','icu','clinical','sourcing','recruiting']
  const lower = value.toLowerCase()
  return skillHints.filter(skill => lower.includes(skill)).slice(0, 18)
}

export function extractEmails(text = '') {
  return Array.from(new Set(text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || [])).slice(0, 5)
}

export function extractUrls(text = '') {
  return Array.from(new Set(text.match(/https?:\/\/[^\s)]+/gi) || [])).slice(0, 8)
}

export function inferOpenToWorkSignals(text: string, source: CandidateSourceName, sourceProfileId?: string): OpenToWorkSignal[] {
  const lower = text.toLowerCase()
  const signals: OpenToWorkSignal[] = []
  const add = (label: string, detail: string, confidence: EvidenceConfidence) => signals.push({ id: uid('otw'), source, sourceProfileId, label, detail, confidence, requiresReview: true, createdAt: nowIso() })
  if (lower.includes('open to work') || lower.includes('#opentowork')) add('Public open-to-work wording', 'Text includes open-to-work language. Treat as a reviewable signal, not a claim.', 'high')
  if (lower.includes('available for contract') || lower.includes('available for freelance') || lower.includes('available for consulting')) add('Availability language', 'Text includes contract/freelance/consulting availability language.', 'medium')
  if (lower.includes('resume') || lower.includes('curriculum vitae') || lower.includes('cv')) add('Resume/CV context', 'A public or uploaded resume/CV is present. This may indicate job-market visibility.', 'medium')
  return signals
}

export function evidenceFromText(text: string, source: CandidateSourceName, sourceProfileId?: string): EvidenceItemRecord[] {
  const normalized = normalizeWhitespace(text)
  const skills = splitSkills(normalized)
  const items: EvidenceItemRecord[] = []
  if (normalized) items.push({ id: uid('ev'), source, sourceProfileId, label: 'Profile summary text', detail: normalized.slice(0, 420), confidence: 'medium', createdAt: nowIso() })
  skills.forEach(skill => items.push({ id: uid('ev'), source, sourceProfileId, label: 'Skill signal', detail: skill, confidence: 'medium', createdAt: nowIso() }))
  extractUrls(text).forEach(url => items.push({ id: uid('ev'), source, sourceProfileId, label: 'Public URL', detail: url, confidence: 'medium', url, createdAt: nowIso() }))
  return items
}

export function contactsFromText(text: string, source: CandidateSourceName, sourceProfileId?: string): CandidateContactSignal[] {
  const contacts: CandidateContactSignal[] = []
  extractEmails(text).forEach(email => contacts.push({ id: uid('ct'), source, sourceProfileId, type: 'email', value: email, confidence: 'medium', verified: false, permissionStatus: 'unknown', createdAt: nowIso() }))
  extractUrls(text).forEach(url => contacts.push({ id: uid('ct'), source, sourceProfileId, type: url.includes('github.com') ? 'github' : url.includes('linkedin.com') ? 'linkedin' : 'website', value: url, confidence: 'medium', verified: false, permissionStatus: 'unknown', createdAt: nowIso() }))
  return contacts
}

export function scoreIdentityMatch(a: SourceProfileRecord, b: SourceProfileRecord) {
  let score = 0
  const reasons: string[] = []
  const conflicts: string[] = []
  const nameA = a.displayName.toLowerCase().trim()
  const nameB = b.displayName.toLowerCase().trim()
  if (nameA && nameB && nameA === nameB) { score += 35; reasons.push('Exact public display-name match') }
  else if (nameA && nameB && (nameA.includes(nameB) || nameB.includes(nameA))) { score += 18; reasons.push('Partial public display-name overlap') }
  if (a.location && b.location) {
    if (a.location.toLowerCase() === b.location.toLowerCase()) { score += 15; reasons.push('Location matches') }
    else conflicts.push(`Location differs: ${a.location} vs ${b.location}`)
  }
  if (a.organization && b.organization) {
    if (a.organization.toLowerCase() === b.organization.toLowerCase()) { score += 15; reasons.push('Organization matches') }
    else conflicts.push(`Organization differs: ${a.organization} vs ${b.organization}`)
  }
  return { score, reasons, conflicts }
}
