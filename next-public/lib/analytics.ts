export type AnalyticsEventName =
  | 'candidate_search_started'
  | 'candidate_search_mode_selected'
  | 'source_lane_opened'
  | 'manual_safe_lane_opened'
  | 'evidence_drawer_opened'
  | 'gated_action_clicked'
  | 'waitlist_started'
  | 'waitlist_submitted'
  | 'tool_used'
  | 'training_cta_clicked'
  | 'guide_cta_clicked'
  | 'job_apply_clicked'
  | 'job_alert_signup'
  | 'submit_job_started'
  | 'submit_job_submitted'

type AnalyticsPayload = Record<string, string | number | boolean | null | undefined>

export type AnalyticsEvent = {
  type: AnalyticsEventName | string
  path?: string
  label?: string
  meta?: Record<string, string>
  time: string
}

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void
    plausible?: (eventName: string, options?: { props?: AnalyticsPayload }) => void
    posthog?: { capture?: (eventName: string, properties?: AnalyticsPayload) => void }
  }
}

function clean(payload: AnalyticsPayload = {}) {
  return Object.fromEntries(Object.entries(payload).filter(([, value]) => value !== undefined)) as AnalyticsPayload
}

export function trackEvent(eventName: AnalyticsEventName, payload: AnalyticsPayload = {}) {
  if (typeof window === 'undefined') return
  const cleanPayload = clean(payload)

  window.gtag?.('event', eventName, cleanPayload)
  window.plausible?.(eventName, { props: cleanPayload })
  window.posthog?.capture?.(eventName, cleanPayload)

  const event: AnalyticsEvent = {
    type: eventName,
    path: window.location.pathname,
    label: typeof cleanPayload.label === 'string' ? cleanPayload.label : undefined,
    meta: Object.fromEntries(Object.entries(cleanPayload).map(([key, value]) => [key, String(value)])),
    time: new Date().toISOString(),
  }

  const key = 'sourcingos.public.analytics'
  try {
    const existing = JSON.parse(localStorage.getItem(key) || '[]') as AnalyticsEvent[]
    localStorage.setItem(key, JSON.stringify([event, ...existing].slice(0, 400)))
  } catch {
    // Local storage is non-critical.
  }

  fetch('/api/analytics', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(event),
  }).catch(() => {})

  if (process.env.NODE_ENV !== 'production') {
    console.debug('[SourcingOS analytics]', eventName, cleanPayload)
  }
}

// Backward-compatible wrapper for older components.
export function trackClientEvent(type: string, label?: string, meta?: Record<string, string>) {
  trackEvent(type as AnalyticsEventName, { label, ...(meta || {}) })
}
