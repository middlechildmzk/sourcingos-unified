import type { RoleIntake } from './role-workspace'

export type OrganizationSignalSource = 'usaspending' | 'sam_gov' | 'warn' | 'funding' | 'other_public'
export type OrganizationSignalKind = 'contract_award' | 'contract_change' | 'workforce_event' | 'funding_event' | 'other_public_event'

export type OrganizationSignal = {
  id: string
  source: OrganizationSignalSource
  kind: OrganizationSignalKind
  organization: string
  headline: string
  whyNow: string
  sourceUrl: string
  sourceRecordId?: string
  agency?: string
  description?: string
  amount?: number
  eventDate?: string
  observedAt: string
  freshnessDays?: number
}

export type OrganizationSignalDisposition = 'new' | 'targeted' | 'dismissed'
export type OrganizationSignalMemoryItem = {
  fingerprint: string
  disposition: OrganizationSignalDisposition
  updatedAt: string
}

const SENSITIVE_PUBLIC_TERMS = /\b(?:ts\/?sci|top secret|secret clearance|secret|public trust|polygraph|clearance|citizenship|citizen)\b/gi

function text(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

export function publicSignalQuery(intake: Pick<RoleIntake, 'title' | 'mustHaves'>): string {
  const terms = [intake.title, ...intake.mustHaves.slice(0, 6)]
    .map(value => text(value.replace(SENSITIVE_PUBLIC_TERMS, ' ')))
    .filter(value => value.length >= 3)
  return Array.from(new Set(terms)).join(' ').slice(0, 240)
}

export function organizationSignalFingerprint(signal: Pick<OrganizationSignal, 'source' | 'kind' | 'organization' | 'sourceRecordId' | 'eventDate'>): string {
  const stable = [signal.source, signal.kind, signal.sourceRecordId || '', signal.organization, signal.eventDate || '']
    .join('|')
    .toLowerCase()
    .replace(/[^a-z0-9|.-]+/g, '-')
  return stable.slice(0, 320)
}

export function signalFreshnessDays(eventDate: string | undefined, now = new Date()): number | undefined {
  if (!eventDate) return undefined
  const date = new Date(eventDate)
  if (Number.isNaN(date.getTime())) return undefined
  return Math.max(0, Math.floor((now.getTime() - date.getTime()) / 86_400_000))
}

export function dedupeOrganizationSignals(signals: OrganizationSignal[]): OrganizationSignal[] {
  const seen = new Set<string>()
  return signals.filter(signal => {
    const key = organizationSignalFingerprint(signal)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export function memoryDisposition(memory: OrganizationSignalMemoryItem[], signal: OrganizationSignal): OrganizationSignalDisposition {
  return [...memory].reverse().find(item => item.fingerprint === organizationSignalFingerprint(signal))?.disposition || 'new'
}

export function updateSignalMemory(
  memory: OrganizationSignalMemoryItem[],
  signal: OrganizationSignal,
  disposition: Exclude<OrganizationSignalDisposition, 'new'>,
  now = new Date().toISOString(),
): OrganizationSignalMemoryItem[] {
  const fingerprint = organizationSignalFingerprint(signal)
  return [
    ...memory.filter(item => item.fingerprint !== fingerprint),
    { fingerprint, disposition, updatedAt: now },
  ].slice(-500)
}
