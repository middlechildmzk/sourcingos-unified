export type CandidateWorkspaceCandidate = {
  id: string
  canonicalName: string
  headline: string
  location?: string
  currentCompany?: string
  currentTitle?: string
  summary: string
  skills: string[]
  sourceProfileIds: string[]
  evidenceItemIds: string[]
  contactSignalIds: string[]
  openToWorkSignalIds: string[]
  mergeStatus: string
  updatedAt?: string
}

export type CandidateWorkspaceMatchReview = {
  id: string
  proposedCanonicalName: string
  score: number
  reasons: string[]
  conflicts: string[]
  decision: string
}

export type CandidateWorkspaceImportBatch = {
  id: string
  importType: string
  fileName?: string
  rowsSeen: number
  recordsCreated: number
  warnings: string[]
  createdAt: string
}

export type CandidateWorkspaceCounts = {
  candidates: number
  filteredCandidates: number
  sourceProfiles: number
  evidenceItems: number
  contactSignals: number
  openToWorkSignals: number
  pendingMatchReviews: number
}

export type CandidateWorkspaceSnapshot = {
  ok: boolean
  persistence_mode: 'preview' | 'supabase'
  candidates: CandidateWorkspaceCandidate[]
  sourceProfiles: Record<string, unknown>[]
  evidenceItems: Record<string, unknown>[]
  contactSignals: Record<string, unknown>[]
  openToWorkSignals: Record<string, unknown>[]
  matchReviews: CandidateWorkspaceMatchReview[]
  importBatches: CandidateWorkspaceImportBatch[]
  counts: CandidateWorkspaceCounts
  page: { limit: number; offset: number; hasMore: boolean }
  search: string
}

export const EMPTY_CANDIDATE_WORKSPACE_SNAPSHOT: CandidateWorkspaceSnapshot = {
  ok: true,
  persistence_mode: 'preview',
  candidates: [],
  sourceProfiles: [],
  evidenceItems: [],
  contactSignals: [],
  openToWorkSignals: [],
  matchReviews: [],
  importBatches: [],
  counts: {
    candidates: 0,
    filteredCandidates: 0,
    sourceProfiles: 0,
    evidenceItems: 0,
    contactSignals: 0,
    openToWorkSignals: 0,
    pendingMatchReviews: 0,
  },
  page: { limit: 50, offset: 0, hasMore: false },
  search: '',
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

function text(value: unknown, fallback = '', max = 5000): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : fallback
}

function optionalText(value: unknown, max = 5000): string | undefined {
  const normalized = text(value, '', max)
  return normalized || undefined
}

function textArray(value: unknown, maxItems = 100, maxLength = 300): string[] {
  if (!Array.isArray(value)) return []
  return Array.from(new Set(value
    .map(item => text(item, '', maxLength))
    .filter(Boolean)))
    .slice(0, maxItems)
}

function count(value: unknown, fallback = 0): number {
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : fallback
}

function bounded(value: unknown, fallback: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, count(value, fallback)))
}

function objectRows(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) return []
  return value.map(record).filter((item): item is Record<string, unknown> => Boolean(item))
}

function identifiedRows(value: unknown): Record<string, unknown>[] {
  return objectRows(value)
    .map(item => ({ ...item, id: text(item.id, '', 200) }))
    .filter(item => Boolean(item.id))
}

function normalizeCandidate(value: unknown, index: number): CandidateWorkspaceCandidate | null {
  const candidate = record(value)
  if (!candidate) return null
  const id = text(candidate.id, `candidate-${index}`, 200)
  const canonicalName = text(candidate.canonicalName ?? candidate.canonical_name, 'Unconfirmed profile', 300)
  return {
    id,
    canonicalName,
    headline: text(candidate.headline, '', 1000),
    location: optionalText(candidate.location, 500),
    currentCompany: optionalText(candidate.currentCompany ?? candidate.current_company, 500),
    currentTitle: optionalText(candidate.currentTitle ?? candidate.current_title, 500),
    summary: text(candidate.summary, '', 10000),
    skills: textArray(candidate.skills, 100, 200),
    sourceProfileIds: textArray(candidate.sourceProfileIds ?? candidate.source_profile_ids, 500, 200),
    evidenceItemIds: textArray(candidate.evidenceItemIds ?? candidate.evidence_item_ids, 1000, 200),
    contactSignalIds: textArray(candidate.contactSignalIds ?? candidate.contact_signal_ids, 500, 200),
    openToWorkSignalIds: textArray(candidate.openToWorkSignalIds ?? candidate.open_to_work_signal_ids, 500, 200),
    mergeStatus: text(candidate.mergeStatus ?? candidate.merge_status, 'pending', 80),
    updatedAt: optionalText(candidate.updatedAt ?? candidate.updated_at, 100),
  }
}

function normalizeMatchReview(value: unknown, index: number): CandidateWorkspaceMatchReview | null {
  const review = record(value)
  if (!review) return null
  return {
    id: text(review.id, `match-review-${index}`, 200),
    proposedCanonicalName: text(review.proposedCanonicalName ?? review.proposed_canonical_name, 'Potential identity match', 300),
    score: bounded(review.score ?? review.match_score, 0, 0, 100),
    reasons: textArray(review.reasons ?? review.match_reasons, 50, 500),
    conflicts: textArray(review.conflicts, 50, 500),
    decision: text(review.decision, 'pending', 80),
  }
}

function normalizeImportBatch(value: unknown, index: number): CandidateWorkspaceImportBatch | null {
  const batch = record(value)
  if (!batch) return null
  return {
    id: text(batch.id, `import-batch-${index}`, 200),
    importType: text(batch.importType ?? batch.import_type, 'candidate_import', 120),
    fileName: optionalText(batch.fileName ?? batch.file_name, 500),
    rowsSeen: count(batch.rowsSeen ?? batch.rows_seen),
    recordsCreated: count(batch.recordsCreated ?? batch.records_created),
    warnings: textArray(batch.warnings, 100, 500),
    createdAt: text(batch.createdAt ?? batch.created_at, '', 100),
  }
}

export function normalizeCandidateWorkspaceSnapshot(value: unknown): CandidateWorkspaceSnapshot {
  const snapshot = record(value) || {}
  const candidates = Array.isArray(snapshot.candidates)
    ? snapshot.candidates.map(normalizeCandidate).filter((item): item is CandidateWorkspaceCandidate => Boolean(item))
    : []
  const matchReviews = Array.isArray(snapshot.matchReviews)
    ? snapshot.matchReviews.map(normalizeMatchReview).filter((item): item is CandidateWorkspaceMatchReview => Boolean(item))
    : []
  const importBatches = Array.isArray(snapshot.importBatches)
    ? snapshot.importBatches.map(normalizeImportBatch).filter((item): item is CandidateWorkspaceImportBatch => Boolean(item))
    : []
  const rawCounts = record(snapshot.counts) || {}
  const rawPage = record(snapshot.page) || {}
  const filteredCandidates = count(rawCounts.filteredCandidates, candidates.length)

  return {
    ok: snapshot.ok !== false,
    persistence_mode: snapshot.persistence_mode === 'supabase' ? 'supabase' : 'preview',
    candidates,
    sourceProfiles: identifiedRows(snapshot.sourceProfiles),
    evidenceItems: identifiedRows(snapshot.evidenceItems),
    contactSignals: identifiedRows(snapshot.contactSignals),
    openToWorkSignals: identifiedRows(snapshot.openToWorkSignals),
    matchReviews,
    importBatches,
    counts: {
      candidates: count(rawCounts.candidates, candidates.length),
      filteredCandidates,
      sourceProfiles: count(rawCounts.sourceProfiles),
      evidenceItems: count(rawCounts.evidenceItems),
      contactSignals: count(rawCounts.contactSignals),
      openToWorkSignals: count(rawCounts.openToWorkSignals),
      pendingMatchReviews: count(rawCounts.pendingMatchReviews, matchReviews.filter(item => item.decision === 'pending').length),
    },
    page: {
      limit: bounded(rawPage.limit, 50, 1, 200),
      offset: count(rawPage.offset),
      hasMore: rawPage.hasMore === true,
    },
    search: text(snapshot.search, '', 200),
  }
}
