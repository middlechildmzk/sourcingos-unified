export type AnalyticsEvent = {
  type: string
  path?: string
  label?: string
  meta?: Record<string, string>
  time: string
}

type AnalyticsPayload = {
  event: string
  page?: string
  label?: string
  source?: string
  variant?: string
  ts: number
  session?: string
}

const STORAGE_KEY = 'sourcingos.public.analytics'
const SESSION_KEY = 'sourcingos.analytics.session'
const SESSION_COOKIE = 'sourcingos_analytics_session'

function writeSessionCookie(value: string) {
  try {
    const secure = window.location.protocol === 'https:' ? '; Secure' : ''
    document.cookie = `${SESSION_COOKIE}=${encodeURIComponent(value)}; Path=/; SameSite=Lax${secure}`
  } catch {
    // Best effort only. Analytics must not affect the product workflow.
  }
}

function getSessionId(): string | undefined {
  if (typeof window === 'undefined') return undefined
  try {
    const existing = window.sessionStorage.getItem(SESSION_KEY)
    if (existing) {
      writeSessionCookie(existing)
      return existing
    }
    const value = typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`
    window.sessionStorage.setItem(SESSION_KEY, value)
    writeSessionCookie(value)
    return value
  } catch {
    return undefined
  }
}

export function trackClientEvent(type: string, label?: string, meta?: Record<string, string>) {
  if (typeof window === 'undefined') return

  const localEvent: AnalyticsEvent = {
    type,
    path: window.location.pathname,
    label,
    meta,
    time: new Date().toISOString(),
  }

  try {
    const existing = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') as AnalyticsEvent[]
    localStorage.setItem(STORAGE_KEY, JSON.stringify([localEvent, ...existing].slice(0, 400)))
  } catch {
    // Analytics must never break the user workflow if browser storage is unavailable.
  }

  const payload: AnalyticsPayload = {
    event: type,
    page: window.location.pathname,
    label,
    source: meta?.source,
    variant: meta?.variant,
    ts: Date.now(),
    session: getSessionId(),
  }

  fetch('/api/analytics/', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
    keepalive: true,
  }).catch(() => {})
}
