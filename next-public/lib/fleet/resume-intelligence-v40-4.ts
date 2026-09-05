import 'server-only'

import { createHash, randomUUID } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import { buildCandidateArtifactV36_10, persistCandidateArtifactV36_10 } from '@/lib/candidate-artifacts-v36-10'
import { refreshPublicUrlWithBrightDataV36_16, searchWebWithBrightDataV36_16 } from '@/lib/agent-data/brightdata-mcp-v36-16'

const RESTRICTED_DOCUMENT_HOSTS = new Set([
  'scribd.com', 'www.scribd.com', 'linkedin.com', 'www.linkedin.com',
  'facebook.com', 'www.facebook.com', 'instagram.com', 'www.instagram.com',
  'x.com', 'www.x.com', 'twitter.com', 'www.twitter.com', 'tiktok.com', 'www.tiktok.com',
])

const GENERIC_PROFILE_HOSTS = new Set([
  'github.com', 'stackoverflow.com', 'stackexchange.com', 'orcid.org', 'linkedin.com',
  'www.linkedin.com', 'npmjs.com', 'pypi.org', 'huggingface.co', 'kaggle.com',
])

export type ResumeCandidateSeedV40_4 = {
  id: string
  canonical_name: string
  headline?: string | null
  location?: string | null
  current_company?: string | null
  current_title?: string | null
}

type KnownProfile = { source: string; profile_url?: string | null; source_profile_id: string; organization?: string | null }

export type ParsedResumeFactV40_4 = {
  factType: 'employment' | 'education' | 'certification' | 'skill' | 'project' | 'professional_url' | 'other'
  factKey: string
  value: Record<string, unknown>
  confidence: 'medium' | 'high'
  verificationStatus: 'source_stated' | 'observed'
}

function clean(value: unknown, max = 1000): string {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, max) : ''
}

function normalizeUrl(raw: string): string | null {
  try {
    const url = new URL(raw.replace(/[),.;]+$/, ''))
    if (!['http:', 'https:'].includes(url.protocol)) return null
    url.hash = ''
    return url.toString()
  } catch {
    return null
  }
}

function hostname(raw: string): string {
  try { return new URL(raw).hostname.toLowerCase() } catch { return '' }
}

function nameTokens(name: string): string[] {
  return clean(name).toLowerCase().split(/[^a-z0-9]+/).filter(token => token.length >= 2)
}

function containsExactName(text: string, name: string): boolean {
  const tokens = nameTokens(name)
  if (tokens.length < 2) return false
  const normalized = text.toLowerCase().replace(/[^a-z0-9]+/g, ' ')
  return normalized.includes(tokens.join(' '))
}

function resumeLikeUrl(url: string): boolean {
  const value = url.toLowerCase()
  const host = hostname(url)
  if (/\.(pdf|doc|docx|rtf)(?:[?#]|$)/i.test(value)) return true
  if (/(^|[\/_-])(resume|curriculum[-_ ]?vitae|cv)([\/_\-.?&#]|$)/i.test(value)) return true
  if (host === 'drive.google.com' || host === 'docs.google.com') return true
  if (host.endsWith('.s3.amazonaws.com') || host === 's3.amazonaws.com') return true
  if (host === 'raw.githubusercontent.com') return true
  return false
}

function searchResultUrls(text: string): string[] {
  const matches = text.match(/https?:\/\/[^\s<>"'\])}]+/gi) || []
  return Array.from(new Set(matches.map(normalizeUrl).filter((url): url is string => Boolean(url))))
}

export function resumeSearchQueriesV40_4(candidate: ResumeCandidateSeedV40_4): string[] {
  const name = `"${clean(candidate.canonical_name, 200)}"`
  const context = [clean(candidate.current_company, 120), clean(candidate.current_title, 120), clean(candidate.location, 120)].filter(Boolean).slice(0, 2).join(' ')
  return [
    `${name} resume ${context}`.trim(),
    `${name} CV ${context}`.trim(),
    `${name} filetype:pdf resume`,
    `${name} filetype:pdf "curriculum vitae"`,
    `${name} (resume OR CV) (site:drive.google.com OR site:docs.google.com)`,
    `${name} (resume OR CV) (site:github.com OR site:raw.githubusercontent.com OR site:github.io)`,
    `${name} (resume OR CV) (site:amazonaws.com OR site:*.edu OR site:*.org)`,
  ]
}

export function parseResumeFactsV40_4(text: string): ParsedResumeFactV40_4[] {
  const lines = text.split(/\r?\n/).map(line => line.trim()).filter(Boolean).slice(0, 1200)
  const facts: ParsedResumeFactV40_4[] = []
  let section = 'other'
  const heading = (line: string) => line.toLowerCase().replace(/[^a-z]/g, ' ').replace(/\s+/g, ' ').trim()

  for (const line of lines) {
    const h = heading(line)
    if (/^(professional )?(experience|employment|work history|career history)$/.test(h)) { section = 'employment'; continue }
    if (/^(education|academic background)$/.test(h)) { section = 'education'; continue }
    if (/^(certifications?|licenses?|credentials?)$/.test(h)) { section = 'certification'; continue }
    if (/^(technical )?(skills|technologies|technology|core competencies|competencies)$/.test(h)) { section = 'skill'; continue }
    if (/^(projects?|selected projects?)$/.test(h)) { section = 'project'; continue }

    if (/https?:\/\//i.test(line)) {
      for (const url of searchResultUrls(line).slice(0, 8)) {
        facts.push({ factType: 'professional_url', factKey: `url:${createHash('sha256').update(url).digest('hex').slice(0, 16)}`, value: { url }, confidence: 'high', verificationStatus: 'observed' })
      }
    }

    if (section === 'skill') {
      const skills = line.split(/[|,;•·]/).map(item => clean(item, 120)).filter(item => item.length >= 2 && item.length <= 80).slice(0, 30)
      for (const skill of skills) facts.push({ factType: 'skill', factKey: `skill:${skill.toLowerCase()}`, value: { name: skill }, confidence: 'medium', verificationStatus: 'source_stated' })
      continue
    }

    if (['employment','education','certification','project'].includes(section) && line.length >= 3 && line.length <= 500) {
      const factType = section as ParsedResumeFactV40_4['factType']
      facts.push({ factType, factKey: `${factType}:${createHash('sha256').update(line.toLowerCase()).digest('hex').slice(0, 20)}`, value: { text: line }, confidence: 'medium', verificationStatus: 'source_stated' })
    }
  }

  const unique = new Map<string, ParsedResumeFactV40_4>()
  for (const fact of facts) unique.set(`${fact.factType}:${fact.factKey}`, fact)
  return [...unique.values()].slice(0, 250)
}

export function resumeIdentityConfidenceV40_4(input: {
  text: string
  candidate: ResumeCandidateSeedV40_4
  profiles: KnownProfile[]
}): { confidence: 'low' | 'medium' | 'high'; reason: string } {
  const text = input.text.toLowerCase()
  if (!containsExactName(text, input.candidate.canonical_name)) {
    return { confidence: 'low', reason: 'Document does not contain the candidate exact full name.' }
  }

  let strong = 0
  let weak = 0
  const reasons: string[] = ['exact full name']

  for (const profile of input.profiles) {
    const raw = clean(profile.profile_url, 2000)
    if (!raw) continue
    try {
      const url = new URL(raw)
      const host = url.hostname.toLowerCase().replace(/^www\./, '')
      const pathToken = url.pathname.split('/').filter(Boolean).at(-1)?.toLowerCase() || ''
      if (pathToken.length >= 3 && text.includes(pathToken)) {
        strong += 1
        reasons.push(`${profile.source} handle`)
      }
      if (!GENERIC_PROFILE_HOSTS.has(host) && !Array.from(GENERIC_PROFILE_HOSTS).some(item => host.endsWith(`.${item}`)) && text.includes(host)) {
        strong += 1
        reasons.push('personal domain')
      }
    } catch {}
  }

  const company = clean(input.candidate.current_company, 200).toLowerCase()
  if (company && company.length >= 3 && text.includes(company)) { weak += 1; reasons.push('current company') }
  const title = clean(input.candidate.current_title, 200).toLowerCase()
  if (title && title.length >= 3 && text.includes(title)) { weak += 1; reasons.push('current title') }
  const location = clean(input.candidate.location, 200).toLowerCase()
  if (location && location.length >= 3 && text.includes(location)) { weak += 1; reasons.push('location') }

  if (strong >= 1 || weak >= 2) return { confidence: 'high', reason: `Matched ${reasons.join(' + ')}.` }
  if (weak >= 1) return { confidence: 'medium', reason: `Matched ${reasons.join(' + ')}, but needs another independent anchor.` }
  return { confidence: 'medium', reason: 'Exact full name matched, but no independent identity anchor was found.' }
}

export async function discoverPublicResumeLeadsV40_4(input: {
  sb: SupabaseClient
  ownerId: string
  candidate: ResumeCandidateSeedV40_4
  queryOffset?: number
  queryLimit?: number
}) {
  const queries = resumeSearchQueriesV40_4(input.candidate)
  const start = Math.max(0, Number(input.queryOffset || 0)) % queries.length
  const count = Math.max(1, Math.min(Number(input.queryLimit || 3), 3))
  const selected = Array.from({ length: count }, (_, index) => queries[(start + index) % queries.length])
  const leads = new Map<string, { url: string; query: string; provider: string; status: string; restrictedReason?: string }>()
  const warnings: string[] = []

  for (const query of selected) {
    try {
      const result = await searchWebWithBrightDataV36_16(query)
      for (const url of searchResultUrls(result.text)) {
        if (!resumeLikeUrl(url)) continue
        const host = hostname(url)
        const restricted = RESTRICTED_DOCUMENT_HOSTS.has(host)
        leads.set(url, {
          url,
          query,
          provider: result.provider,
          status: restricted ? 'restricted_metadata_only' : 'discovered',
          restrictedReason: restricted ? 'Host requires login/subscription or is intentionally excluded from unattended deep retrieval.' : undefined,
        })
      }
    } catch (error) {
      warnings.push(`${query}: ${error instanceof Error ? error.message : 'search failed'}`)
    }
  }

  let persisted = 0
  for (const lead of leads.values()) {
    const normalized = normalizeUrl(lead.url)
    if (!normalized) continue
    const { error } = await input.sb.from('public_document_leads').upsert({
      owner_id: input.ownerId,
      candidate_id: input.candidate.id,
      url: lead.url,
      normalized_url: normalized,
      host: hostname(normalized),
      document_kind: 'resume_cv',
      discovery_query: lead.query,
      discovery_provider: lead.provider,
      status: lead.status,
      restricted_reason: lead.restrictedReason || null,
      discovered_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'owner_id,candidate_id,normalized_url', ignoreDuplicates: false })
    if (!error) persisted += 1
    else warnings.push(`lead write: ${error.message}`)
  }

  return { queries: selected, found: leads.size, persisted, warnings }
}

function factsFingerprint(candidateId: string, sourceUrl: string, fact: ParsedResumeFactV40_4): string {
  return createHash('sha256').update(`${candidateId}|${sourceUrl}|${fact.factType}|${fact.factKey}|${JSON.stringify(fact.value)}`).digest('hex')
}

export async function fetchParseAttachResumeLeadV40_4(input: {
  sb: SupabaseClient
  ownerId: string
  leadId: string
}) {
  const { data: lead, error: leadError } = await input.sb.from('public_document_leads').select('*').eq('id', input.leadId).eq('owner_id', input.ownerId).maybeSingle()
  if (leadError || !lead) return { ok: false, attached: false, error: leadError?.message || 'Resume lead not found.' }
  if (lead.status === 'restricted_metadata_only') return { ok: true, attached: false, needsReview: false, restricted: true }

  const [{ data: candidate, error: candidateError }, { data: profiles, error: profileError }] = await Promise.all([
    input.sb.from('candidates').select('id,canonical_name,headline,location,current_company,current_title').eq('id', lead.candidate_id).eq('owner_id', input.ownerId).maybeSingle(),
    input.sb.from('source_profiles').select('source,source_profile_id,profile_url,organization').eq('candidate_id', lead.candidate_id).eq('owner_id', input.ownerId).limit(50),
  ])
  if (candidateError || !candidate) return { ok: false, attached: false, error: candidateError?.message || 'Candidate not found.' }
  if (profileError) return { ok: false, attached: false, error: profileError.message }

  let pageText = ''
  try {
    const refreshed = await refreshPublicUrlWithBrightDataV36_16(lead.url)
    pageText = refreshed.text.slice(0, 100_000)
  } catch (error) {
    await input.sb.from('public_document_leads').update({ status: 'fetch_failed', last_checked_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', lead.id).eq('owner_id', input.ownerId)
    return { ok: false, attached: false, error: error instanceof Error ? error.message : 'Public document fetch failed.' }
  }

  if (pageText.trim().length < 200) {
    await input.sb.from('public_document_leads').update({ status: 'fetch_failed', last_checked_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', lead.id).eq('owner_id', input.ownerId)
    return { ok: false, attached: false, error: 'Document did not yield enough public text to parse.' }
  }

  const identity = resumeIdentityConfidenceV40_4({ text: pageText, candidate, profiles: profiles || [] })
  if (identity.confidence !== 'high') {
    await input.sb.from('public_document_leads').update({
      status: 'identity_review', identity_confidence: identity.confidence, identity_reason: identity.reason,
      last_checked_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    }).eq('id', lead.id).eq('owner_id', input.ownerId)
    return { ok: true, attached: false, needsReview: true, identity }
  }

  const sourceProfileId = createHash('sha256').update(lead.normalized_url).digest('hex')
  const observedAt = new Date().toISOString()
  let sourceProfileUuid: string | null = null
  const { data: existing } = await input.sb.from('source_profiles').select('id').eq('owner_id', input.ownerId).eq('source', 'resume_xray').eq('source_profile_id', sourceProfileId).maybeSingle()
  if (existing?.id) {
    sourceProfileUuid = existing.id
    await input.sb.from('source_profiles').update({ candidate_id: candidate.id, profile_url: lead.url, display_name: candidate.canonical_name, raw_text: pageText.slice(0, 50_000), status: 'confirmed', last_seen_at: observedAt, updated_at: observedAt, acquisition_basis: 'public_web', usage_scope: ['search','enrichment','candidate_profile'], search_allowed: true, raw_export_allowed: false, retention_until: new Date(Date.now() + 90 * 86400_000).toISOString(), refresh_after: new Date(Date.now() + 30 * 86400_000).toISOString(), rights_metadata: { publicAccess: true, noAuthBypass: true, sourceUrl: lead.url, rawRetentionDays: 90 } }).eq('id', existing.id).eq('owner_id', input.ownerId)
  } else {
    sourceProfileUuid = randomUUID()
    const { error } = await input.sb.from('source_profiles').insert({
      id: sourceProfileUuid, owner_id: input.ownerId, candidate_id: candidate.id, source: 'resume_xray', source_profile_id: sourceProfileId,
      profile_url: lead.url, display_name: candidate.canonical_name, headline: 'Public Resume/CV', location: candidate.location || null,
      organization: candidate.current_company || null, raw_text: pageText.slice(0, 50_000), raw: { type: 'public_resume_cv', sourceUrl: lead.url, contactValuesCaptured: false },
      status: 'confirmed', match_score: 0, match_reasons: ['Exact name plus independent public identity anchor(s) matched'],
      last_seen_at: observedAt, created_at: observedAt, updated_at: observedAt, acquisition_basis: 'public_web',
      usage_scope: ['search','enrichment','candidate_profile'], search_allowed: true, raw_export_allowed: false,
      retention_until: new Date(Date.now() + 90 * 86400_000).toISOString(), refresh_after: new Date(Date.now() + 30 * 86400_000).toISOString(),
      rights_metadata: { publicAccess: true, noAuthBypass: true, sourceUrl: lead.url, rawRetentionDays: 90 },
    })
    if (error) return { ok: false, attached: false, error: `Resume source profile write failed: ${error.message}` }
  }

  const artifact = buildCandidateArtifactV36_10({
    text: pageText, candidateId: candidate.id, sourceProfileId: sourceProfileUuid || undefined,
    artifactType: 'resume', dataOrigin: 'public_web', fileName: new URL(lead.url).pathname.split('/').filter(Boolean).at(-1) || 'public-resume',
    mimeType: lead.url.toLowerCase().includes('.pdf') ? 'application/pdf' : 'text/html', sourceUrl: lead.url, observedAt,
    metadata: { discovery: 'resume_xray_v40_4', identityConfidence: identity.confidence, identityReason: identity.reason, publicAccess: true, contactValuesCaptured: false },
  })
  const artifactResult = await persistCandidateArtifactV36_10({ sb: input.sb, ownerId: input.ownerId, artifact })
  if (!artifactResult.ok) return { ok: false, attached: false, error: artifactResult.warning || 'Artifact write failed.' }

  const facts = parseResumeFactsV40_4(pageText)
  let factsWritten = 0
  for (const fact of facts) {
    const fingerprint = factsFingerprint(candidate.id, lead.normalized_url, fact)
    const { error } = await input.sb.from('candidate_profile_facts').upsert({
      owner_id: input.ownerId, candidate_id: candidate.id, source_profile_id: sourceProfileUuid, artifact_id: artifact.id,
      fact_type: fact.factType, fact_key: fact.factKey, value: fact.value, confidence: fact.confidence,
      verification_status: fact.verificationStatus, source: 'resume_xray', source_url: lead.url,
      fingerprint, observed_at: observedAt, updated_at: observedAt,
    }, { onConflict: 'owner_id,candidate_id,fingerprint' })
    if (!error) factsWritten += 1
  }

  const evidenceRows = facts.slice(0, 80).map(fact => ({
    id: randomUUID(), owner_id: input.ownerId, candidate_id: candidate.id, source_profile_id: sourceProfileUuid,
    source: 'resume_xray', label: `Public resume · ${fact.factType.replace('_', ' ')}`,
    detail: clean((fact.value.text || fact.value.name || fact.value.url || '') as string, 500),
    confidence: fact.confidence, url: lead.url, created_at: observedAt,
  })).filter(row => row.detail)
  if (evidenceRows.length) await input.sb.from('evidence_items').insert(evidenceRows)

  const resumeSkills = facts.filter(fact => fact.factType === 'skill').map(fact => clean(fact.value.name, 80)).filter(Boolean)
  if (resumeSkills.length) {
    const currentSkills = Array.isArray((candidate as any).skills) ? (candidate as any).skills : []
    const merged = Array.from(new Set([...currentSkills, ...resumeSkills].map(value => clean(value, 80)).filter(Boolean))).slice(0, 200)
    await input.sb.from('candidates').update({ skills: merged, last_refreshed_at: observedAt, updated_at: observedAt }).eq('id', candidate.id).eq('owner_id', input.ownerId)
  } else {
    await input.sb.from('candidates').update({ last_refreshed_at: observedAt, updated_at: observedAt }).eq('id', candidate.id).eq('owner_id', input.ownerId)
  }

  await input.sb.from('public_document_leads').update({
    status: 'parsed_attached', identity_confidence: 'high', identity_reason: identity.reason,
    content_sha256: artifact.contentSha256, artifact_id: artifact.id, last_checked_at: observedAt, updated_at: observedAt,
  }).eq('id', lead.id).eq('owner_id', input.ownerId)

  return { ok: true, attached: true, identity, artifactId: artifact.id, factsWritten, evidenceWritten: evidenceRows.length, contactValuesCaptured: false }
}
