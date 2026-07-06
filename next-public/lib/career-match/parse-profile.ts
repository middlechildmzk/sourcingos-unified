import type { ClearanceSignal, EvidenceStatus, ParsedSignal, RecruitingRoleFamily, ResumeProfile, SeniorityLevel } from './types'
import { recruitingRoleTaxonomy, roleFamilyOrder } from './role-taxonomy'

const CURRENT_YEAR = new Date().getFullYear()

const ATS_CRM_TOOLS = [
  'greenhouse', 'lever', 'workday', 'icims', 'ashby', 'smartrecruiters', 'taleo', 'jobvite', 'avature',
  'phenom', 'bullhorn', 'salesforce', 'hubspot', 'gem', 'beamery', 'eightfold', 'gr8 people', 'kenexa',
]

const SOURCING_TOOLS = [
  'linkedin recruiter', 'linkedin talent insights', 'seekout', 'hireez', 'hiretual', 'clearancejobs', 'dice',
  'github', 'stackoverflow', 'stack overflow', 'contactout', 'lusha', 'zoominfo', 'apollo', 'indeed', 'monster',
]

const INDUSTRY_SIGNALS: Record<string, string[]> = {
  software: ['software', 'engineer', 'developer', 'frontend', 'backend', 'full stack', 'saas'],
  cybersecurity: ['cybersecurity', 'security engineer', 'infosec', 'soc', 'rmf', 'nist'],
  cloud: ['cloud', 'aws', 'azure', 'gcp', 'devops', 'sre', 'infrastructure'],
  data: ['data engineer', 'data science', 'analytics', 'machine learning', 'ml', 'ai'],
  healthcare: ['healthcare', 'clinical', 'nurse', 'rn', 'lpn', 'cna', 'provider', 'physician', 'hospital'],
  federal: ['federal', 'govcon', 'government', 'dod', 'defense', 'clearance', 'ts/sci', 'public sector'],
  hrtech: ['hrtech', 'hr technology', 'people ops', 'talent operations'],
  fintech: ['fintech', 'banking', 'payments', 'finance'],
  rpo: ['rpo', 'staffing', 'agency', 'client delivery', 'sla'],
  startup: ['startup', 'series a', 'series b', 'high growth'],
}

const CLEARANCE_TERMS = [
  'secret clearance', 'top secret', 'ts/sci', 'ts sci', 'polygraph', 'full scope poly', 'ci poly',
  'security clearance', 'cleared', 'clearancejobs', 'dod', 'govcon', 'federal cleared',
]

function normalizeText(text: string): string {
  return String(text || '')
    .replace(/\r/g, '\n')
    .replace(/[\t\u00a0]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function lower(text: string): string {
  return text.toLowerCase()
}

function unique<T>(items: T[]): T[] {
  return Array.from(new Set(items.filter(Boolean)))
}

function includesAny(text: string, terms: string[]): boolean {
  const body = lower(text)
  return terms.some(term => body.includes(term.toLowerCase()))
}

function findTerms(text: string, terms: string[]): string[] {
  const body = lower(text)
  return unique(terms.filter(term => body.includes(term.toLowerCase())))
}

function cleanTitleCandidate(line: string): string {
  let value = line.trim()
  value = value.replace(/^[-•*\u2022\s]+/, '')
  value = value.replace(/\s+/g, ' ')
  value = value.replace(/\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+\d{4}\b.*$/i, '')
  value = value.replace(/\b\d{4}\s*(?:-|–|—|to)\s*(?:present|current|now|\d{4}).*$/i, '')
  value = value.replace(/\s+(?:at|@)\s+.+$/i, '')
  value = value.replace(/[,|]\s+[A-Z0-9][A-Za-z0-9&.\-\s]{2,}$/g, '')
  value = value.replace(/\s[-–—]\s+[A-Z0-9][A-Za-z0-9&.\-\s]{2,}$/g, '')
  return value.trim().slice(0, 90)
}

function looksLikeTitleLine(line: string): boolean {
  const clean = line.trim()
  if (!clean || clean.length < 5 || clean.length > 140) return false
  if (/^(experience|professional experience|employment|skills|tools|education|certifications|summary|profile)$/i.test(clean)) return false
  if (/^(email|phone|linkedin|github|portfolio|tools|skills)\s*:/i.test(clean)) return false
  if (/https?:\/\//i.test(clean)) return false
  const titleTerms = roleFamilyOrder.flatMap(family => recruitingRoleTaxonomy[family].titleSignals)
  return includesAny(clean, titleTerms)
}

function extractTitles(text: string): string[] {
  const lines = normalizeText(text).split('\n').map(line => line.trim()).filter(Boolean)
  const candidates = lines.filter(looksLikeTitleLine).map(cleanTitleCandidate).filter(Boolean)
  return unique(candidates).slice(0, 8)
}

function extractYears(text: string): number | null {
  const body = lower(text)
  const explicit = body.match(/(\d{1,2})\+?\s*(?:years|yrs)\s+(?:of\s+)?(?:experience|recruiting|sourcing|talent acquisition)/)
  if (explicit) return Math.min(Number(explicit[1]), 30)

  const years = Array.from(body.matchAll(/\b(20\d{2}|19\d{2})\b/g)).map(match => Number(match[1])).filter(year => year >= 1990 && year <= CURRENT_YEAR)
  if (!years.length) return null
  const earliest = Math.min(...years)
  const estimated = CURRENT_YEAR - earliest
  if (estimated <= 0 || estimated > 35) return null
  return estimated
}

function inferSeniority(titles: string[], years: number | null, text: string): SeniorityLevel {
  const combined = `${titles.join(' ')} ${text}`.toLowerCase()
  if (/\b(vp|vice president|head of talent|chief people|director)\b/.test(combined)) return 'director-plus'
  if (/\b(manager|leadership|managed a team|people manager)\b/.test(combined)) return 'manager'
  if (/\b(lead|principal|staff)\b/.test(combined)) return 'lead'
  if (/\b(senior|sr\.?|ii|iii)\b/.test(combined)) return 'senior-ic'
  if (years !== null) {
    if (years >= 12) return 'director-plus'
    if (years >= 8) return 'lead'
    if (years >= 5) return 'senior-ic'
    if (years >= 2) return 'mid'
    return 'entry'
  }
  return 'unknown'
}

function inferFamilies(text: string, titles: string[]): RecruitingRoleFamily[] {
  const titleText = titles.join(' ').toLowerCase()
  const combined = `${titleText} ${text}`.toLowerCase()
  const scores = roleFamilyOrder.map(family => {
    const entry = recruitingRoleTaxonomy[family]
    let score = 0
    for (const term of entry.titleSignals) {
      const normalized = term.toLowerCase()
      if (titleText.includes(normalized)) score += normalized.includes(' ') ? 10 : 4
      else if (combined.includes(normalized)) score += normalized.includes(' ') ? 5 : 2
    }
    for (const term of entry.skillSignals) if (combined.includes(term)) score += 2
    for (const term of entry.toolSignals) if (combined.includes(term)) score += 1
    for (const term of entry.industrySignals) if (combined.includes(term)) score += 1
    return { family, score }
  })
  return scores.filter(row => row.score > 0).sort((a, b) => b.score - a.score).map(row => row.family)
}

function extractIndustries(text: string): string[] {
  const body = lower(text)
  return Object.entries(INDUSTRY_SIGNALS)
    .filter(([, terms]) => terms.some(term => body.includes(term)))
    .map(([industry]) => industry)
}

function extractLocations(text: string): string[] {
  const locations = new Set<string>()
  const cityStateMatches = Array.from(text.matchAll(/\b([A-Z][a-z]+(?:\s[A-Z][a-z]+){0,2}),\s*([A-Z]{2})\b/g))
  for (const match of cityStateMatches) locations.add(`${match[1]}, ${match[2]}`)
  if (/\bremote\b/i.test(text)) locations.add('Remote')
  if (/\bhybrid\b/i.test(text)) locations.add('Hybrid')
  return Array.from(locations).slice(0, 6)
}

function extractSpecialties(text: string, families: RecruitingRoleFamily[], industries: string[]): string[] {
  const specialties = new Set<string>()
  for (const family of families) specialties.add(recruitingRoleTaxonomy[family].label)
  if (industries.includes('federal')) specialties.add('Federal / GovCon recruiting')
  if (industries.includes('healthcare')) specialties.add('Healthcare recruiting')
  if (industries.includes('data') || includesAny(text, ['ai', 'machine learning', 'llm'])) specialties.add('AI / ML recruiting')
  if (includesAny(text, ['market mapping', 'talent intelligence', 'competitor analysis'])) specialties.add('Talent intelligence')
  return Array.from(specialties).slice(0, 8)
}

function clearanceSignal(text: string): ClearanceSignal {
  const signals = CLEARANCE_TERMS.filter(term => lower(text).includes(term)).map<ParsedSignal>(term => ({
    value: term,
    evidence: term,
    status: 'unverified-breadcrumb',
  }))
  if (!signals.length) {
    return {
      status: 'not-present',
      signals: [],
      note: 'No clearance terms were found in the resume text.',
    }
  }
  return {
    status: 'unverified-breadcrumb',
    signals: unique(signals.map(signal => signal.value)).map(value => ({ value, evidence: value, status: 'unverified-breadcrumb' })),
    note: 'Clearance terms are public resume breadcrumbs only. SourcingOS does not verify active clearance.',
  }
}

function buildSummary(profile: Omit<ResumeProfile, 'profileSummary' | 'confidenceNotes'>): string {
  const parts = [profile.currentTitle]
  if (profile.yearsExperience !== null) parts.push(profile.yearsExperienceLabel)
  if (profile.specialties.length) parts.push(profile.specialties.slice(0, 3).join(', '))
  if (profile.tools.length) parts.push(`Tools: ${profile.tools.slice(0, 5).join(', ')}`)
  return parts.filter(Boolean).join(' | ')
}

export function parseRecruitingResumeProfile(rawText: string): ResumeProfile {
  const text = normalizeText(rawText)
  const titles = extractTitles(text)
  const yearsExperience = extractYears(text)
  const families = inferFamilies(text, titles)
  const primaryFamily = families[0] || 'recruiter'
  const seniority = inferSeniority(titles, yearsExperience, text)
  const atsCrmTools = findTerms(text, ATS_CRM_TOOLS)
  const sourcingTools = findTerms(text, SOURCING_TOOLS)
  const tools = unique([...atsCrmTools, ...sourcingTools])
  const industries = extractIndustries(text)
  const specialties = extractSpecialties(text, families, industries)
  const locations = extractLocations(text)
  const clearance = clearanceSignal(text)

  const base = {
    rawText: text,
    currentTitle: titles[0] || recruitingRoleTaxonomy[primaryFamily].label,
    pastTitles: titles.slice(1),
    yearsExperience,
    yearsExperienceLabel: yearsExperience === null ? 'Years of experience not confidently detected' : `${yearsExperience} years estimated from resume dates or text`,
    seniority,
    primaryFamily,
    roleFamilies: families.length ? families : [primaryFamily],
    specialties,
    tools,
    atsCrmTools,
    sourcingTools,
    industries,
    locations,
    clearance,
  }

  return {
    ...base,
    profileSummary: buildSummary(base),
    confidenceNotes: [
      'Deterministic profile parser. No AI-generated resume facts are added.',
      'Years of experience is an estimate when explicit years are not present.',
      clearance.status === 'unverified-breadcrumb'
        ? 'Clearance-related terms were found, but active clearance is not verified.'
        : 'No clearance terms were found.',
    ],
  }
}

export function statusLabel(status: EvidenceStatus): string {
  if (status === 'found-in-resume') return 'Found in resume'
  if (status === 'inferred-from-resume') return 'Inferred from resume'
  if (status === 'unverified-breadcrumb') return 'Unverified breadcrumb'
  return 'Not present'
}
