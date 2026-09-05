export type UniversalPeopleSearchIntentV36_9 =
  | 'email_lookup'
  | 'phone_lookup'
  | 'linkedin_lookup'
  | 'github_lookup'
  | 'profile_lookup'
  | 'person_lookup'
  | 'professional_search'

export type UniversalPeopleSearchDraftV36_9 = {
  query: string
  title?: string
  company?: string
  location?: string
  skills?: string
  limit?: number
}

export type UniversalPeopleProviderRequestV36_9 = {
  query: string
  requirements?: Array<{ text: string; mustHave: boolean }>
  names?: string[]
  titles?: string[]
  skills?: string[]
  companies?: string[]
  locations?: string[]
  limit: number
  highFreshness: boolean
}

export type UniversalExactIdentityRequestV36_9 = {
  purpose: 'identity_enrichment'
  email?: string
  phone?: string
  linkedinUrl?: string
  githubUrl?: string
  profileUrl?: string
  sourceContext: 'universal_people_search_v36_9'
}

function clean(value?: string): string {
  return String(value || '').replace(/\s+/g, ' ').trim()
}

function splitList(value?: string, max = 30): string[] {
  return Array.from(new Set(String(value || '')
    .split(/[,\n;]/)
    .map(item => clean(item))
    .filter(Boolean)))
    .slice(0, max)
}

function splitLocations(value?: string, max = 20): string[] {
  return Array.from(new Set(String(value || '')
    .split(/[\n;]/)
    .map(item => clean(item))
    .filter(Boolean)))
    .slice(0, max)
}

export function normalizeUniversalPeopleIdentifierV36_9(value: string): string {
  const cleaned = clean(value)
  if (/^(?:www\.)?(?:linkedin\.com|github\.com)\//i.test(cleaned)) return `https://${cleaned}`
  return cleaned
}

function exactHttpUrl(value: string): URL | null {
  const normalized = normalizeUniversalPeopleIdentifierV36_9(value)
  if (!/^https?:\/\//i.test(normalized)) return null
  try {
    const parsed = new URL(normalized)
    return ['http:', 'https:'].includes(parsed.protocol) ? parsed : null
  } catch {
    return null
  }
}

const PROFESSIONAL_ROLE_HINTS = new Set([
  'administrator', 'admin', 'engineer', 'developer', 'architect', 'manager', 'director', 'recruiter', 'sourcer',
  'analyst', 'specialist', 'technician', 'consultant', 'scientist', 'researcher', 'designer', 'product', 'sales',
  'nurse', 'physician', 'doctor', 'attorney', 'accountant', 'security', 'linux', 'rhel', 'devops', 'devsecops',
  'software', 'hardware', 'systems', 'system', 'network', 'data', 'cloud', 'cyber', 'cybersecurity', 'clearance',
])

function normalizedRoleToken(value: string): string {
  return value.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '')
}

function isProfessionalRoleHint(value: string): boolean {
  const token = normalizedRoleToken(value)
  if (!token) return false
  if (PROFESSIONAL_ROLE_HINTS.has(token)) return true
  if (token.endsWith('ies') && PROFESSIONAL_ROLE_HINTS.has(`${token.slice(0, -3)}y`)) return true
  if (token.endsWith('es') && PROFESSIONAL_ROLE_HINTS.has(token.slice(0, -2))) return true
  if (token.endsWith('s') && PROFESSIONAL_ROLE_HINTS.has(token.slice(0, -1))) return true
  return false
}

const EXPLICIT_SKILL_PATTERNS: Array<[string, RegExp]> = [
  ['RHEL', /\bRHEL\b/i],
  ['Red Hat Enterprise Linux', /\bRed Hat Enterprise Linux\b/i],
  ['Red Hat', /\bRed Hat\b/i],
  ['Linux', /\bLinux\b/i],
  ['SELinux', /\bSELinux\b/i],
  ['Ansible', /\bAnsible\b/i],
  ['Satellite', /\b(?:Red Hat )?Satellite\b/i],
  ['Kubernetes', /\bKubernetes\b/i],
  ['Docker', /\bDocker\b/i],
  ['Terraform', /\bTerraform\b/i],
  ['AWS', /\bAWS\b/i],
  ['Azure', /\bAzure\b/i],
  ['GCP', /\bGCP\b/i],
  ['Python', /\bPython\b/i],
  ['Java', /\bJava\b/i],
  ['JavaScript', /\bJavaScript\b/i],
  ['TypeScript', /\bTypeScript\b/i],
  ['React', /\bReact\b/i],
  ['Node.js', /\bNode(?:\.js|JS)\b/i],
  ['SQL', /\bSQL\b/i],
  ['Splunk', /\bSplunk\b/i],
  ['VMware', /\bVMware\b/i],
  ['Active Directory', /\bActive Directory\b/i],
]

function stripSearchLeadIn(value: string): string {
  return clean(value)
    .replace(/^(?:please\s+)?(?:find(?:\s+me)?|show(?:\s+me)?|source|search\s+for|look\s+for|looking\s+for|i\s+need|need)\s+/i, '')
    .replace(/^\d{1,3}\s+/, '')
    .replace(/^(?:an?|the)\s+/i, '')
}

function inferProfessionalTitle(query: string): string | undefined {
  if (classifyUniversalPeopleSearchV36_9(query) !== 'professional_search') return undefined
  const cleaned = stripSearchLeadIn(query)
  if (!cleaned) return undefined

  const locationBoundary = cleaned.search(/\b(?:in\s+or\s+near|in\s+or\s+around|located\s+in|based\s+in|near|around|in)\s+[A-Za-z][A-Za-z .’'\-]{1,60},\s*[A-Z]{2}\b/i)
  const semanticBoundary = cleaned.search(/\b(?:with|who|that|at)\b/i)
  const boundaries = [locationBoundary, semanticBoundary].filter(index => index >= 0)
  const boundary = boundaries.length ? Math.min(...boundaries) : -1

  let candidate = boundary > 0 ? clean(cleaned.slice(0, boundary)) : cleaned
  if (boundary < 0) {
    const tokens = cleaned.split(/\s+/)
    let lastRoleHint = -1
    tokens.forEach((token, index) => { if (isProfessionalRoleHint(token)) lastRoleHint = index })
    if (lastRoleHint >= 0 && lastRoleHint < tokens.length - 1) candidate = tokens.slice(0, lastRoleHint + 1).join(' ')
  }
  candidate = candidate.replace(/^(?:an?|the)\s+/i, '').replace(/[,:;]+$/, '').trim()
  if (!candidate || candidate.length > 100) return undefined
  return candidate.split(/\s+/).some(isProfessionalRoleHint) ? candidate : undefined
}

function inferProfessionalLocation(query: string): string | undefined {
  const explicit = clean(query).match(/\b(?:in\s+or\s+near|in\s+or\s+around|located\s+in|based\s+in|near|around|in)\s+([A-Za-z][A-Za-z .’'\-]{1,60},\s*[A-Z]{2})\b/i)
  return explicit?.[1] ? clean(explicit[1]) : undefined
}

function inferExplicitSkills(query: string): string[] {
  const found: string[] = []
  for (const [label, pattern] of EXPLICIT_SKILL_PATTERNS) {
    if (pattern.test(query) && !found.includes(label)) found.push(label)
  }
  return found.slice(0, 20)
}

function inferQueryRequirements(query: string): Array<{ text: string; mustHave: boolean }> {
  const requirements: Array<{ text: string; mustHave: boolean }> = []
  const years = clean(query).match(/\b(\d{1,2})\s*\+?\s*(?:years?|yrs?)\b[^,.;]{0,30}/i)
  if (years) {
    const plus = /\d{1,2}\s*\+/.test(years[0]) ? '+' : ''
    requirements.push({ text: `${years[1]}${plus} years relevant experience`, mustHave: true })
  }
  const clearance = clean(query).match(/\b(?:TS\s*\/\s*SCI|TS\s+SCI|Top Secret|Secret|Confidential|Public Trust)(?:\s+(?:security\s+)?clearance)?(?:\s+or\s+higher)?\b/i)
  if (clearance) requirements.push({ text: clean(clearance[0]), mustHave: true })
  return requirements
}

function regexpEscape(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function inferredSkillMustHave(query: string, skill: string, inferredTitle?: string): boolean {
  const skillPattern = regexpEscape(skill).replace(/\\ /g, '\\s+')
  if (inferredTitle && new RegExp(`(?:^|\\b)${skillPattern}(?:\\b|$)`, 'i').test(inferredTitle)) return true

  // A conjunction introduced by "with" is treated as a hard recruiter constraint,
  // but alternatives remain discovery options: "with AWS or Azure" must not become
  // an accidental AWS AND Azure requirement.
  const withClause = clean(query).match(/\bwith\b([^,.;]{0,140})/i)?.[1] || ''
  if (withClause && new RegExp(`(?:^|\\b)${skillPattern}(?:\\b|$)`, 'i').test(withClause)) {
    if (/\bor\b/i.test(withClause)) return false
    return true
  }

  const hardCue = new RegExp(`\\b(?:must\\s+have|required|requires?|requiring|mandatory)\\b[^,.;]{0,80}(?:^|\\b)${skillPattern}(?:\\b|$)`, 'i')
  return hardCue.test(query)
}

export function classifyUniversalPeopleSearchV36_9(value: string): UniversalPeopleSearchIntentV36_9 {
  const query = clean(value)
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/i.test(query)) return 'email_lookup'
  const digits = query.replace(/\D/g, '')
  if (digits.length >= 7 && digits.length <= 15 && /^[+()\-\.\s\d]+$/.test(query)) return 'phone_lookup'
  const url = exactHttpUrl(query)
  if (url) {
    const host = url.hostname.toLowerCase().replace(/^www\./, '')
    if (host === 'linkedin.com' && /^\/in\//i.test(url.pathname)) return 'linkedin_lookup'
    if (host === 'github.com' && url.pathname.split('/').filter(Boolean).length >= 1) return 'github_lookup'
    return 'profile_lookup'
  }
  const tokens = query.split(/\s+/).filter(Boolean)
  const hasRoleHint = tokens.some(isProfessionalRoleHint)
  const nameLike = !hasRoleHint
    && tokens.length >= 2
    && tokens.length <= 4
    && tokens.every(token => /^[\p{L}][\p{L}'’.\-]*$/u.test(token))
  if (nameLike) return 'person_lookup'
  return 'professional_search'
}

export function universalPeopleIntentLabelV36_9(intent: UniversalPeopleSearchIntentV36_9): string {
  if (intent === 'email_lookup') return 'Email lookup'
  if (intent === 'phone_lookup') return 'Phone lookup'
  if (intent === 'linkedin_lookup') return 'LinkedIn profile lookup'
  if (intent === 'github_lookup') return 'GitHub profile lookup'
  if (intent === 'profile_lookup') return 'Profile URL lookup'
  if (intent === 'person_lookup') return 'Person lookup'
  return 'Professional people search'
}

export function buildUniversalExactIdentityRequestV36_9(value: string): UniversalExactIdentityRequestV36_9 | undefined {
  const query = normalizeUniversalPeopleIdentifierV36_9(value)
  const intent = classifyUniversalPeopleSearchV36_9(query)
  const base = { purpose: 'identity_enrichment' as const, sourceContext: 'universal_people_search_v36_9' as const }
  if (intent === 'email_lookup') return { ...base, email: query }
  if (intent === 'phone_lookup') return { ...base, phone: query }
  if (intent === 'linkedin_lookup') return { ...base, linkedinUrl: query, profileUrl: query }
  if (intent === 'github_lookup') return { ...base, githubUrl: query, profileUrl: query }
  if (intent === 'profile_lookup') return { ...base, profileUrl: query }
  return undefined
}

function hasProfessionalRoleHint(value: string): boolean {
  return value.split(/\s+/).some(isProfessionalRoleHint)
}

function looksLikeExplicitPersonName(value: string): boolean {
  const tokens = clean(value).split(/\s+/).filter(Boolean)
  return tokens.length >= 2
    && tokens.length <= 4
    && !hasProfessionalRoleHint(value)
    && tokens.every(token => /^[\p{L}][\p{L}'’.\-]*$/u.test(token))
}

/** Explicit syntax is parsed before generic intent classification so `Jane Doe at Acme`
 * and `Jane Doe, Acme` remain deterministic identity anchors. The left side must
 * actually look like a compact person name, so geographic commas such as
 * `St. Paul, MN` in a recruiter refinement can never become fake company anchors. */
function inferPersonSearchAnchors(query: string, explicitCompany?: string): { names: string[]; companies: string[] } {
  const value = clean(query)
  const companies = explicitCompany ? [clean(explicitCompany)] : []
  if (!value) return { names: [], companies }

  const atMatch = value.match(/^(.+?)\s+at\s+(.+)$/i)
  if (atMatch && looksLikeExplicitPersonName(atMatch[1])) {
    return { names: [clean(atMatch[1])], companies: companies.length ? companies : [clean(atMatch[2])] }
  }
  const commaMatch = value.match(/^([^,]+),\s*(.+)$/)
  if (commaMatch && looksLikeExplicitPersonName(commaMatch[1])) {
    return { names: [clean(commaMatch[1])], companies: companies.length ? companies : [clean(commaMatch[2])] }
  }

  const intent = classifyUniversalPeopleSearchV36_9(value)
  if (intent !== 'person_lookup') return { names: [], companies }
  const tokens = value.split(/\s+/).filter(Boolean)
  if (companies.length) return { names: [value], companies }
  if (tokens.length === 2) return { names: [value], companies: [] }
  if (tokens.length === 3) return { names: [tokens.slice(0, 2).join(' ')], companies: [tokens[2]] }
  return { names: [], companies: [] }
}

export function buildUniversalPeopleProviderRequestV36_9(
  draft: UniversalPeopleSearchDraftV36_9,
): UniversalPeopleProviderRequestV36_9 {
  const query = clean(draft.query)
  const explicitCompany = clean(draft.company)
  const explicitTitles = splitList(draft.title, 20)
  const explicitSkills = splitList(draft.skills, 40)
  const explicitLocations = splitLocations(draft.location, 20)
  const intent = classifyUniversalPeopleSearchV36_9(query)
  const professionalIntent = intent === 'professional_search'
  const personAnchors = inferPersonSearchAnchors(query, explicitCompany)

  const inferredTitle = professionalIntent && !explicitTitles.length ? inferProfessionalTitle(query) : undefined
  const inferredLocation = professionalIntent && !explicitLocations.length ? inferProfessionalLocation(query) : undefined
  const inferredSkills = professionalIntent ? inferExplicitSkills(query) : []
  const inferredOnlySkills = inferredSkills.filter(skill => !explicitSkills.some(explicit => explicit.toLowerCase() === skill.toLowerCase()))

  const titles = Array.from(new Set([...explicitTitles, ...(inferredTitle ? [inferredTitle] : [])])).slice(0, 20)
  const skills = Array.from(new Set([...explicitSkills, ...inferredSkills])).slice(0, 40)
  const locations = Array.from(new Set([...explicitLocations, ...(inferredLocation ? [inferredLocation] : [])])).slice(0, 20)
  const companies = Array.from(new Set(personAnchors.companies.filter(Boolean))).slice(0, 20)
  const names = Array.from(new Set(personAnchors.names.filter(Boolean))).slice(0, 20)
  const context = [query, explicitCompany ? `company ${explicitCompany}` : ''].filter(Boolean).join(' · ').slice(0, 3000)
  const requirements = [
    ...titles.map(text => ({ text: `Current or relevant title: ${text}`, mustHave: false })),
    ...companies.map(text => ({ text: `Current or relevant employer: ${text}`, mustHave: false })),
    ...explicitSkills.map(text => ({ text, mustHave: true })),
    ...inferredOnlySkills.map(text => ({ text, mustHave: inferredSkillMustHave(query, text, inferredTitle) })),
    ...(professionalIntent ? inferQueryRequirements(query) : []),
  ].slice(0, 30)

  return {
    query: context || 'professional person search',
    ...(requirements.length ? { requirements } : {}),
    ...(names.length ? { names } : {}),
    ...(titles.length ? { titles } : {}),
    ...(skills.length ? { skills } : {}),
    ...(companies.length ? { companies } : {}),
    ...(locations.length ? { locations } : {}),
    limit: Math.max(1, Math.min(50, Math.trunc(draft.limit || 30))),
    highFreshness: false,
  }
}

export function exactLinkedInAnchorV36_9(profileUrls: Array<{ kind: string; url: string }>): string | undefined {
  const item = profileUrls.find(profile => profile.kind === 'linkedin')
  if (!item?.url) return undefined
  try {
    const url = new URL(item.url)
    if (!/(^|\.)linkedin\.com$/i.test(url.hostname)) return undefined
    url.hash = ''
    url.search = ''
    return url.toString().replace(/\/$/, '').toLowerCase()
  } catch {
    return undefined
  }
}