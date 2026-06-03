// ─────────────────────────────────────────────────────────────────────────────
// lib/search/saved-sessions.ts — Saved search sessions.
//
// localStorage-first (works for public + signed-in). Types are schema-ready so a
// future `search_sessions` Supabase table can persist the same shape unchanged.
// ─────────────────────────────────────────────────────────────────────────────

export interface SavedSearchSession {
  id: string
  userId?: string                  // set when signed-in + server-persisted
  projectId?: string
  roleTitle: string
  rawQuery: string
  liveSearchTerms: string[]        // skill/tool terms that drove public APIs
  reviewFilters: string[]          // title/seniority/location
  manualSafeConstraints: string[]  // clearance etc.
  exclusions: string[]
  sourceLanes: string[]
  resultCount: number
  createdAt: string
  updatedAt: string
}

const STORAGE_KEY = 'sourcingos.search-sessions.v1'
const MAX_SESSIONS = 20

function read(): SavedSearchSession[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as SavedSearchSession[]) : []
  } catch { return [] }
}

function write(sessions: SavedSearchSession[]) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions.slice(0, MAX_SESSIONS)))
  } catch { /* quota or disabled — non-fatal */ }
}

export function listSessions(): SavedSearchSession[] {
  return read().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

export function saveSession(input: Omit<SavedSearchSession, 'id' | 'createdAt' | 'updatedAt'>): SavedSearchSession {
  const now = new Date().toISOString()
  const sessions = read()
  // Dedupe by rawQuery — update existing rather than pile up
  const existing = sessions.find(s => s.rawQuery === input.rawQuery && s.projectId === input.projectId)
  if (existing) {
    Object.assign(existing, input, { updatedAt: now })
    write(sessions)
    return existing
  }
  const session: SavedSearchSession = {
    ...input,
    id: `sess_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    createdAt: now,
    updatedAt: now,
  }
  write([session, ...sessions])
  return session
}

export function deleteSession(id: string) {
  write(read().filter(s => s.id !== id))
}

export function clearSessions() {
  write([])
}
