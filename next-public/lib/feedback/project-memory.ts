// ─────────────────────────────────────────────────────────────────────────────
// lib/feedback/project-memory.ts — Recruiter feedback → project memory.
//
// localStorage-first, schema-ready for future Supabase `feedback_events` +
// `project_memories` tables. Project-scoped. Inspectable + resettable by user.
// Never sends data to train any external model; informs local suggestions only.
// ─────────────────────────────────────────────────────────────────────────────

export type FeedbackType =
  | 'good_fit' | 'strong_profile' | 'maybe_needs_review' | 'not_a_fit'
  | 'too_junior' | 'too_senior' | 'wrong_location' | 'wrong_industry'
  | 'wrong_tech' | 'wrong_clearance' | 'false_positive' | 'saved'
  | 'hm_liked' | 'hm_rejected'

export interface FeedbackEvent {
  id: string
  projectId: string          // 'default' when no project selected
  sourceProfileId?: string
  candidateId?: string
  searchSessionQuery?: string
  feedbackType: FeedbackType
  matchedSkills?: string[]
  source?: string
  title?: string
  createdAt: string
}

export interface ProjectMemory {
  projectId: string
  positivePatterns: string[]
  negativePatterns: string[]
  cautionPatterns: string[]
  preferredSkills: string[]
  rejectedSkills: string[]
  preferredTitles: string[]
  rejectedTitles: string[]
  sourcePerformance: Record<string, { positive: number; negative: number }>
  updatedAt: string
}

const EVENTS_KEY = 'sourcingos.feedback-events.v1'
const POSITIVE: FeedbackType[] = ['good_fit', 'strong_profile', 'saved', 'hm_liked']
const NEGATIVE: FeedbackType[] = ['not_a_fit', 'too_junior', 'too_senior', 'wrong_location', 'wrong_industry', 'wrong_tech', 'wrong_clearance', 'false_positive', 'hm_rejected']

function read(): FeedbackEvent[] {
  if (typeof window === 'undefined') return []
  try { const r = window.localStorage.getItem(EVENTS_KEY); return r ? JSON.parse(r) : [] } catch { return [] }
}
function write(events: FeedbackEvent[]) {
  if (typeof window === 'undefined') return
  try { window.localStorage.setItem(EVENTS_KEY, JSON.stringify(events.slice(-500))) } catch { /* non-fatal */ }
}

export function recordFeedback(e: Omit<FeedbackEvent, 'id' | 'createdAt'>): FeedbackEvent {
  const event: FeedbackEvent = { ...e, id: `fb_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, createdAt: new Date().toISOString() }
  write([...read(), event])
  return event
}

export function getProjectMemory(projectId = 'default'): ProjectMemory {
  const events = read().filter(e => e.projectId === projectId)
  const preferredSkills = new Map<string, number>()
  const rejectedSkills = new Map<string, number>()
  const preferredTitles = new Set<string>()
  const rejectedTitles = new Set<string>()
  const sourcePerformance: Record<string, { positive: number; negative: number }> = {}

  for (const e of events) {
    const isPos = POSITIVE.includes(e.feedbackType)
    const isNeg = NEGATIVE.includes(e.feedbackType)
    ;(e.matchedSkills || []).forEach(s => {
      const m = isPos ? preferredSkills : isNeg ? rejectedSkills : null
      if (m) m.set(s, (m.get(s) || 0) + 1)
    })
    if (e.title) { if (isPos) preferredTitles.add(e.title); if (isNeg) rejectedTitles.add(e.title) }
    if (e.source) {
      sourcePerformance[e.source] = sourcePerformance[e.source] || { positive: 0, negative: 0 }
      if (isPos) sourcePerformance[e.source].positive++
      if (isNeg) sourcePerformance[e.source].negative++
    }
  }

  const topSkills = (m: Map<string, number>) => [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([s]) => s)
  const cautions: string[] = []
  if (events.some(e => e.feedbackType === 'wrong_clearance')) cautions.push('Public clearance breadcrumb only — verify manually')
  if (events.some(e => e.feedbackType === 'false_positive')) cautions.push('Watch for false positives — tighten exclusions')

  return {
    projectId,
    positivePatterns: topSkills(preferredSkills),
    negativePatterns: topSkills(rejectedSkills),
    cautionPatterns: cautions,
    preferredSkills: topSkills(preferredSkills),
    rejectedSkills: topSkills(rejectedSkills),
    preferredTitles: [...preferredTitles].slice(0, 6),
    rejectedTitles: [...rejectedTitles].slice(0, 6),
    sourcePerformance,
    updatedAt: new Date().toISOString(),
  }
}

export function clearProjectMemory(projectId = 'default') {
  write(read().filter(e => e.projectId !== projectId))
}

export function hasFeedback(projectId = 'default'): boolean {
  return read().some(e => e.projectId === projectId)
}
