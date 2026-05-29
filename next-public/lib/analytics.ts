export type AnalyticsEvent = { type: string; path?: string; label?: string; meta?: Record<string, string>; time: string };

export function trackClientEvent(type: string, label?: string, meta?: Record<string, string>) {
  if (typeof window === 'undefined') return;
  const event: AnalyticsEvent = { type, path: window.location.pathname, label, meta, time: new Date().toISOString() };
  const key = 'sourcingos.public.analytics';
  const existing = JSON.parse(localStorage.getItem(key) || '[]') as AnalyticsEvent[];
  localStorage.setItem(key, JSON.stringify([event, ...existing].slice(0, 400)));
  fetch('/api/analytics', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(event) }).catch(() => {});
}
