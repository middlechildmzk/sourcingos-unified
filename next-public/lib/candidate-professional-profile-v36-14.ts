import type {
  CandidateProviderCertificationV36_14,
  CandidateProviderEducationV36_14,
  CandidateProviderExperienceV36_14,
  CandidateProviderProjectV36_14,
  CandidateProviderRichProfileV36_14,
} from '@/lib/candidate-data/types-v36-8'

export type CandidateProfileSourceV36_14 = {
  source: string
  sourceProfileId?: string
  sourceProfileRecordId?: string
  lastSeenAt?: string
}

export type CandidateProfileSummaryV36_14 = {
  text: string
  sources: CandidateProfileSourceV36_14[]
}

export type CandidateProfileExperienceV36_14 = CandidateProviderExperienceV36_14 & {
  id: string
  sources: CandidateProfileSourceV36_14[]
}

export type CandidateProfileEducationV36_14 = CandidateProviderEducationV36_14 & {
  id: string
  sources: CandidateProfileSourceV36_14[]
}

export type CandidateProfileCertificationV36_14 = CandidateProviderCertificationV36_14 & {
  id: string
  sources: CandidateProfileSourceV36_14[]
}

export type CandidateProfileProjectV36_14 = CandidateProviderProjectV36_14 & {
  id: string
  sources: CandidateProfileSourceV36_14[]
}

export type CandidateProfessionalProfileV36_14 = {
  summaries: CandidateProfileSummaryV36_14[]
  experience: CandidateProfileExperienceV36_14[]
  education: CandidateProfileEducationV36_14[]
  certifications: CandidateProfileCertificationV36_14[]
  projects: CandidateProfileProjectV36_14[]
  structuredSourceCount: number
  sourceCount: number
  trustBoundary: string
}

type SourceProfileLike = {
  id?: unknown
  source?: unknown
  source_profile_id?: unknown
  sourceProfileId?: unknown
  last_seen_at?: unknown
  lastSeenAt?: unknown
  raw?: unknown
  raw_text?: unknown
  rawText?: unknown
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function text(value: unknown, max = 2000): string | undefined {
  if (typeof value !== 'string') return undefined
  const normalized = value.replace(/\s+/g, ' ').trim()
  return normalized ? normalized.slice(0, max) : undefined
}

function bool(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined
}

function parseRaw(profile: SourceProfileLike): Record<string, unknown> {
  const direct = record(profile.raw)
  if (Object.keys(direct).length) return direct
  const rawText = typeof profile.rawText === 'string'
    ? profile.rawText
    : typeof profile.raw_text === 'string'
      ? profile.raw_text
      : ''
  if (!rawText) return {}
  try { return record(JSON.parse(rawText)) } catch { return {} }
}

function richProfileFromStoredSource(profile: SourceProfileLike): CandidateProviderRichProfileV36_14 | undefined {
  const stored = parseRaw(profile)
  // Saved provider observations are stored as SourceResult, with provider-only
  // structured history nested under SourceResult.raw.richProfile.
  const providerRaw = record(stored.raw)
  const rich = record(providerRaw.richProfile)
  if (!Object.keys(rich).length) {
    // Compatibility with any preview/manual fixture that stores richProfile at
    // the top level. This does not grant additional merge authority.
    const direct = record(stored.richProfile)
    if (!Object.keys(direct).length) return undefined
    return direct as CandidateProviderRichProfileV36_14
  }
  return rich as CandidateProviderRichProfileV36_14
}

function sourceFor(profile: SourceProfileLike): CandidateProfileSourceV36_14 {
  return {
    source: text(profile.source, 80) || 'unknown',
    sourceProfileId: text(profile.sourceProfileId ?? profile.source_profile_id, 180),
    sourceProfileRecordId: text(profile.id, 180),
    lastSeenAt: text(profile.lastSeenAt ?? profile.last_seen_at, 80),
  }
}

function normalized(value?: string): string {
  return String(value || '').toLowerCase().replace(/[^a-z0-9+#./-]+/g, ' ').replace(/\s+/g, ' ').trim()
}

function stableId(prefix: string, key: string): string {
  const slug = normalized(key).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 120)
  return `${prefix}:${slug || 'observation'}`
}

function uniqueSources(values: CandidateProfileSourceV36_14[]): CandidateProfileSourceV36_14[] {
  const seen = new Set<string>()
  return values.filter(source => {
    const key = `${source.source}:${source.sourceProfileId || source.sourceProfileRecordId || ''}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function boundedExperience(value: CandidateProviderExperienceV36_14): CandidateProviderExperienceV36_14 | null {
  const item = {
    title: text(value.title, 240),
    company: text(value.company, 240),
    location: text(value.location, 240),
    startDate: text(value.startDate, 80),
    endDate: text(value.endDate, 80),
    current: bool(value.current),
    description: text(value.description, 1400),
  }
  return item.title || item.company || item.description ? item : null
}

function boundedEducation(value: CandidateProviderEducationV36_14): CandidateProviderEducationV36_14 | null {
  const item = {
    school: text(value.school, 260),
    degree: text(value.degree, 260),
    field: text(value.field, 260),
    startDate: text(value.startDate, 80),
    endDate: text(value.endDate, 80),
    description: text(value.description, 1000),
  }
  return item.school || item.degree || item.field ? item : null
}

function boundedCertification(value: CandidateProviderCertificationV36_14): CandidateProviderCertificationV36_14 | null {
  const name = text(value.name, 300)
  if (!name) return null
  return {
    name,
    issuer: text(value.issuer, 260),
    issuedAt: text(value.issuedAt, 80),
    expiresAt: text(value.expiresAt, 80),
    credentialUrl: text(value.credentialUrl, 1000),
  }
}

function boundedProject(value: CandidateProviderProjectV36_14): CandidateProviderProjectV36_14 | null {
  const name = text(value.name, 300)
  if (!name) return null
  return {
    name,
    description: text(value.description, 1200),
    url: text(value.url, 1000),
    technologies: Array.from(new Set((value.technologies || []).map(item => text(item, 120)).filter(Boolean) as string[])).slice(0, 24),
  }
}

function dateSortValue(value?: string): number {
  if (!value) return 0
  const parsed = Date.parse(value)
  if (!Number.isNaN(parsed)) return parsed
  const year = Number(String(value).match(/\b(19|20)\d{2}\b/)?.[0])
  return Number.isFinite(year) ? Date.UTC(year, 0, 1) : 0
}

export function buildCandidateProfessionalProfileV36_14(sourceProfiles: SourceProfileLike[] = []): CandidateProfessionalProfileV36_14 {
  const summaries = new Map<string, CandidateProfileSummaryV36_14>()
  const experience = new Map<string, CandidateProfileExperienceV36_14>()
  const education = new Map<string, CandidateProfileEducationV36_14>()
  const certifications = new Map<string, CandidateProfileCertificationV36_14>()
  const projects = new Map<string, CandidateProfileProjectV36_14>()
  let structuredSourceCount = 0

  for (const profile of sourceProfiles) {
    const rich = richProfileFromStoredSource(profile)
    if (!rich) continue
    structuredSourceCount += 1
    const source = sourceFor(profile)

    const summary = text(rich.summary, 2000)
    if (summary) {
      const key = normalized(summary)
      const existing = summaries.get(key)
      if (existing) existing.sources = uniqueSources([...existing.sources, source])
      else summaries.set(key, { text: summary, sources: [source] })
    }

    for (const raw of Array.isArray(rich.experience) ? rich.experience.slice(0, 40) : []) {
      const item = boundedExperience(raw)
      if (!item) continue
      const key = [item.title, item.company, item.location, item.startDate, item.endDate, item.current ? 'current' : ''].map(normalized).join('|')
      const existing = experience.get(key)
      if (existing) existing.sources = uniqueSources([...existing.sources, source])
      else experience.set(key, { ...item, id: stableId('experience', key), sources: [source] })
    }

    for (const raw of Array.isArray(rich.education) ? rich.education.slice(0, 30) : []) {
      const item = boundedEducation(raw)
      if (!item) continue
      const key = [item.school, item.degree, item.field, item.startDate, item.endDate].map(normalized).join('|')
      const existing = education.get(key)
      if (existing) existing.sources = uniqueSources([...existing.sources, source])
      else education.set(key, { ...item, id: stableId('education', key), sources: [source] })
    }

    for (const raw of Array.isArray(rich.certifications) ? rich.certifications.slice(0, 30) : []) {
      const item = boundedCertification(raw)
      if (!item) continue
      const key = [item.name, item.issuer, item.issuedAt, item.expiresAt].map(normalized).join('|')
      const existing = certifications.get(key)
      if (existing) existing.sources = uniqueSources([...existing.sources, source])
      else certifications.set(key, { ...item, id: stableId('certification', key), sources: [source] })
    }

    for (const raw of Array.isArray(rich.projects) ? rich.projects.slice(0, 24) : []) {
      const item = boundedProject(raw)
      if (!item) continue
      const key = [item.name, item.url].map(normalized).join('|')
      const existing = projects.get(key)
      if (existing) existing.sources = uniqueSources([...existing.sources, source])
      else projects.set(key, { ...item, id: stableId('project', key), sources: [source] })
    }
  }

  return {
    summaries: [...summaries.values()].sort((a, b) => b.text.length - a.text.length),
    experience: [...experience.values()].sort((a, b) => {
      if (Boolean(a.current) !== Boolean(b.current)) return a.current ? -1 : 1
      return Math.max(dateSortValue(b.endDate), dateSortValue(b.startDate)) - Math.max(dateSortValue(a.endDate), dateSortValue(a.startDate))
    }),
    education: [...education.values()].sort((a, b) => dateSortValue(b.endDate || b.startDate) - dateSortValue(a.endDate || a.startDate)),
    certifications: [...certifications.values()].sort((a, b) => dateSortValue(b.issuedAt) - dateSortValue(a.issuedAt)),
    projects: [...projects.values()],
    structuredSourceCount,
    sourceCount: sourceProfiles.length,
    trustBoundary: 'Structured profile sections are provider-observed professional data. Exact duplicate observations may be coalesced for display while preserving all contributing sources; conflicting or non-identical observations remain separate and are never silently reconciled into qualification truth.',
  }
}
