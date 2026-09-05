import 'server-only'

import { createHash } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'

export type StructuredEnrichmentTaskKindV40_4 =
  | 'employment_history'
  | 'skills_evidence'
  | 'education'
  | 'certification'
  | 'professional_urls'
  | 'portfolio_projects'
  | 'publication_patents'
  | 'location_refresh'
  | 'employer_refresh'
  | 'profile_quality'

export const STRUCTURED_ENRICHMENT_AGENT_BY_TASK_V40_4: Record<StructuredEnrichmentTaskKindV40_4, string> = {
  employment_history: 'enrich-employment-1',
  skills_evidence: 'enrich-skills-1',
  education: 'enrich-education',
  certification: 'enrich-certifications',
  professional_urls: 'enrich-urls',
  portfolio_projects: 'enrich-projects',
  publication_patents: 'enrich-publications',
  location_refresh: 'enrich-location',
  employer_refresh: 'enrich-employment-2',
  profile_quality: 'ops-quality',
}

export const STRUCTURED_ENRICHMENT_TASK_ORDER_V40_4: StructuredEnrichmentTaskKindV40_4[] = [
  'employment_history',
  'skills_evidence',
  'professional_urls',
  'education',
  'certification',
  'portfolio_projects',
  'employer_refresh',
  'location_refresh',
  'publication_patents',
  'profile_quality',
]

type StoredProfile = {
  id: string
  source: string
  source_profile_id: string
  profile_url?: string | null
  headline?: string | null
  location?: string | null
  organization?: string | null
  raw?: unknown
  last_seen_at?: string | null
}

type FactInput = {
  factType: 'employment' | 'education' | 'certification' | 'skill' | 'project' | 'publication' | 'patent' | 'professional_url' | 'location' | 'headline' | 'other'
  factKey: string
  value: Record<string, unknown>
  confidence: 'medium' | 'high'
  verificationStatus: 'source_stated' | 'observed'
  profile: StoredProfile
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function clean(value: unknown, max = 1600): string {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, max) : ''
}

function stringArray(value: unknown, max = 100): string[] {
  return Array.isArray(value)
    ? Array.from(new Set(value.map(item => clean(item, 160)).filter(Boolean))).slice(0, max)
    : []
}

function providerRichProfile(profile: StoredProfile): Record<string, unknown> {
  const stored = record(profile.raw)
  const providerRaw = record(stored.raw)
  const nested = record(providerRaw.richProfile)
  if (Object.keys(nested).length) return nested
  return record(stored.richProfile)
}

function safeProfessionalUrl(value: unknown): string | null {
  const raw = clean(value, 2000)
  if (!raw || raw.includes('@')) return null
  try {
    const url = new URL(raw)
    return ['http:', 'https:'].includes(url.protocol) ? url.toString() : null
  } catch {
    return null
  }
}

function compactObject(value: unknown, allowed: string[]): Record<string, unknown> {
  const source = record(value)
  const out: Record<string, unknown> = {}
  for (const key of allowed) {
    const item = source[key]
    if (typeof item === 'string') {
      const bounded = clean(item, key === 'description' ? 1600 : 400)
      if (bounded) out[key] = bounded
    } else if (typeof item === 'boolean' || typeof item === 'number') out[key] = item
    else if (Array.isArray(item)) {
      const values = stringArray(item, 30)
      if (values.length) out[key] = values
    }
  }
  return out
}

function factKey(prefix: string, value: unknown): string {
  return `${prefix}:${createHash('sha256').update(JSON.stringify(value)).digest('hex').slice(0, 24)}`
}

function factsForTask(taskKind: StructuredEnrichmentTaskKindV40_4, profiles: StoredProfile[]): FactInput[] {
  const facts: FactInput[] = []
  for (const profile of profiles) {
    const stored = record(profile.raw)
    const rich = providerRichProfile(profile)

    if (taskKind === 'employment_history') {
      for (const row of Array.isArray(rich.experience) ? rich.experience.slice(0, 40) : []) {
        const value = compactObject(row, ['title','company','location','startDate','endDate','current','description'])
        if (!Object.keys(value).length) continue
        facts.push({ factType: 'employment', factKey: factKey('employment', value), value, confidence: 'medium', verificationStatus: 'source_stated', profile })
      }
    } else if (taskKind === 'education') {
      for (const row of Array.isArray(rich.education) ? rich.education.slice(0, 30) : []) {
        const value = compactObject(row, ['school','degree','field','startDate','endDate','description'])
        if (!Object.keys(value).length) continue
        facts.push({ factType: 'education', factKey: factKey('education', value), value, confidence: 'medium', verificationStatus: 'source_stated', profile })
      }
    } else if (taskKind === 'certification') {
      for (const row of Array.isArray(rich.certifications) ? rich.certifications.slice(0, 30) : []) {
        const value = compactObject(row, ['name','issuer','issuedAt','expiresAt','credentialUrl'])
        if (!Object.keys(value).length) continue
        facts.push({ factType: 'certification', factKey: factKey('certification', value), value, confidence: 'medium', verificationStatus: 'source_stated', profile })
      }
    } else if (taskKind === 'portfolio_projects') {
      for (const row of Array.isArray(rich.projects) ? rich.projects.slice(0, 30) : []) {
        const value = compactObject(row, ['name','description','url','technologies'])
        if (!Object.keys(value).length) continue
        facts.push({ factType: 'project', factKey: factKey('project', value), value, confidence: 'medium', verificationStatus: 'source_stated', profile })
      }
    } else if (taskKind === 'skills_evidence') {
      for (const skill of stringArray(stored.skills, 150)) {
        const value = { name: skill }
        facts.push({ factType: 'skill', factKey: `skill:${skill.toLowerCase()}`, value, confidence: 'medium', verificationStatus: 'observed', profile })
      }
    } else if (taskKind === 'professional_urls') {
      const urls = new Set<string>()
      const direct = safeProfessionalUrl(profile.profile_url)
      if (direct) urls.add(direct)
      const signals = Array.isArray(stored.contactSignals) ? stored.contactSignals : []
      for (const signal of signals.slice(0, 50)) {
        const item = record(signal)
        if (!['website','social'].includes(clean(item.type, 40).toLowerCase())) continue
        const url = safeProfessionalUrl(item.value)
        if (url) urls.add(url)
      }
      for (const url of urls) facts.push({ factType: 'professional_url', factKey: factKey('url', url), value: { url }, confidence: 'high', verificationStatus: 'observed', profile })
    } else if (taskKind === 'location_refresh') {
      const location = clean(profile.location, 300)
      if (location) facts.push({ factType: 'location', factKey: factKey('location', location.toLowerCase()), value: { location }, confidence: 'medium', verificationStatus: 'source_stated', profile })
    } else if (taskKind === 'employer_refresh') {
      const company = clean(profile.organization, 300)
      const title = clean(profile.headline, 300)
      if (company || title) facts.push({ factType: 'employment', factKey: factKey('current', { company, title }), value: { company: company || undefined, title: title || undefined, current: true }, confidence: 'medium', verificationStatus: 'source_stated', profile })
    } else if (taskKind === 'publication_patents') {
      const providerRaw = record(stored.raw)
      for (const [key, type] of [['publications','publication'], ['patents','patent']] as const) {
        const rows = Array.isArray(providerRaw[key]) ? providerRaw[key] : Array.isArray(stored[key]) ? stored[key] : []
        for (const row of rows.slice(0, 40)) {
          const value = typeof row === 'string' ? { text: clean(row, 1200) } : compactObject(row, ['title','name','description','url','date','year','publisher','issuer'])
          if (!Object.keys(value).length) continue
          facts.push({ factType: type, factKey: factKey(type, value), value, confidence: 'medium', verificationStatus: 'source_stated', profile })
        }
      }
    }
  }
  return facts
}

async function persistFact(sb: SupabaseClient, ownerId: string, candidateId: string, fact: FactInput) {
  const fingerprint = createHash('sha256')
    .update(`${candidateId}|${fact.profile.source}|${fact.profile.source_profile_id}|${fact.factType}|${fact.factKey}|${JSON.stringify(fact.value)}`)
    .digest('hex')
  const observedAt = fact.profile.last_seen_at || new Date().toISOString()
  const { error } = await sb.from('candidate_profile_facts').upsert({
    owner_id: ownerId,
    candidate_id: candidateId,
    source_profile_id: fact.profile.id,
    fact_type: fact.factType,
    fact_key: fact.factKey,
    value: fact.value,
    confidence: fact.confidence,
    verification_status: fact.verificationStatus,
    source: fact.profile.source,
    source_url: safeProfessionalUrl(fact.profile.profile_url),
    fingerprint,
    observed_at: observedAt,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'owner_id,candidate_id,fingerprint' })
  return error?.message || null
}

export async function runStructuredProfileEnrichmentV40_4(input: {
  sb: SupabaseClient
  ownerId: string
  candidateId: string
  taskKind: StructuredEnrichmentTaskKindV40_4
}) {
  const { data: profiles, error } = await input.sb.from('source_profiles')
    .select('id,source,source_profile_id,profile_url,headline,location,organization,raw,last_seen_at')
    .eq('owner_id', input.ownerId)
    .eq('candidate_id', input.candidateId)
    .order('last_seen_at', { ascending: false })
    .limit(100)
  if (error) throw new Error(error.message)

  if (input.taskKind === 'profile_quality') {
    const { data: facts } = await input.sb.from('candidate_profile_facts').select('fact_type').eq('owner_id', input.ownerId).eq('candidate_id', input.candidateId).limit(1000)
    const types = new Set((facts || []).map(row => String(row.fact_type)))
    const dimensions = {
      identity: (profiles || []).length > 0,
      employment: types.has('employment'),
      skills: types.has('skill'),
      education: types.has('education'),
      certifications: types.has('certification'),
      professionalUrls: types.has('professional_url'),
      projects: types.has('project'),
      publicationsOrPatents: types.has('publication') || types.has('patent'),
    }
    const complete = Object.values(dimensions).filter(Boolean).length
    return { taskKind: input.taskKind, profilesRead: (profiles || []).length, factsFound: 0, factsWritten: 0, errors: 0, quality: { dimensions, percent: Math.round((complete / Object.keys(dimensions).length) * 100) } }
  }

  const generated = factsForTask(input.taskKind, (profiles || []) as StoredProfile[])
  let written = 0
  const warnings: string[] = []
  for (const fact of generated.slice(0, 250)) {
    const warning = await persistFact(input.sb, input.ownerId, input.candidateId, fact)
    if (warning) warnings.push(warning)
    else written += 1
  }
  if (written > 0) {
    await input.sb.from('candidates').update({ last_refreshed_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('owner_id', input.ownerId).eq('id', input.candidateId)
  }
  return { taskKind: input.taskKind, profilesRead: (profiles || []).length, factsFound: generated.length, factsWritten: written, errors: warnings.length, warnings: Array.from(new Set(warnings)).slice(0, 20) }
}
