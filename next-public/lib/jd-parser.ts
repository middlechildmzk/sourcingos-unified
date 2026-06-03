// ─────────────────────────────────────────────────────────────────────────────
// lib/jd-parser.ts — Deterministic JD / resume parsing into a structured profile.
//
// Rule-based only. Uses the search taxonomy for entity recognition.
// No AI, no protected-trait inference, no verified clearance/open-to-work claims.
// ─────────────────────────────────────────────────────────────────────────────
import { ALL_TAXONOMY, EntityType } from '@/data/search-taxonomy'
import { EXPANSIONS } from '@/data/search-expansions'

export interface ParsedJD {
  roleTitle: string
  mustHaveSkills: string[]
  preferredSkills: string[]
  tools: string[]
  seniority: string
  location: string
  clearance: string[]
  industries: string[]
  targetCompanies: string[]
  relatedTitles: string[]
  likelyFalsePositives: string[]
  suggestedBooleanTerms: string[]
  suggestedSourceLanes: string[]
  /** Pre-built composer query string from hard terms */
  composerQuery: string
}

export interface ParsedResume {
  currentTitle: string
  companies: string[]
  skills: string[]
  tools: string[]
  location: string
  links: string[]
  contactSignals: { type: string; value: string; note: string }[]
  evidenceSnippets: string[]
}

// ── Entity recognition over arbitrary text ────────────────────────────────────
interface Recognized { canonical: string; type: EntityType }

function recognizeEntities(text: string): Recognized[] {
  const lower = text.toLowerCase()
  const found: Recognized[] = []
  const seen = new Set<string>()

  for (const entry of ALL_TAXONOMY) {
    for (const alias of entry.aliases) {
      // Word-boundary-ish check to avoid partial matches
      const idx = lower.indexOf(alias)
      if (idx !== -1) {
        const before = idx === 0 ? ' ' : lower[idx - 1]
        const after = idx + alias.length >= lower.length ? ' ' : lower[idx + alias.length]
        const boundaryOk = /[^a-z0-9]/.test(before) && /[^a-z0-9]/.test(after)
        if (boundaryOk && !seen.has(entry.canonical)) {
          found.push({ canonical: entry.canonical, type: entry.type })
          seen.add(entry.canonical)
        }
        break
      }
    }
  }
  return found
}

// ── Section detection for must-have vs preferred ──────────────────────────────
function extractSection(text: string, headers: string[], stopHeaders: string[] = []): string {
  const lower = text.toLowerCase()
  for (const header of headers) {
    const idx = lower.indexOf(header)
    if (idx !== -1) {
      // Section runs from this header until the next stop-header or blank line or 600 chars
      let end = idx + 600
      // Stop at the next opposing section header (e.g. must-have stops at "preferred")
      for (const stop of stopHeaders) {
        const stopIdx = lower.indexOf(stop, idx + header.length)
        if (stopIdx !== -1 && stopIdx < end) end = stopIdx
      }
      const section = text.slice(idx, Math.min(end, idx + 600))
      const nextBreak = section.search(/\n\s*\n/)
      return nextBreak > 0 ? section.slice(0, nextBreak) : section
    }
  }
  return ''
}

// ── Seniority detection ────────────────────────────────────────────────────────
function detectSeniority(text: string): string {
  const lower = text.toLowerCase()
  if (/\b(principal|distinguished)\b/.test(lower)) return 'Principal'
  if (/\b(staff)\b/.test(lower)) return 'Staff'
  if (/\b(senior|sr\.?|lead)\b/.test(lower)) return 'Senior'
  if (/\b(junior|jr\.?|entry.level|associate)\b/.test(lower)) return 'Junior'
  return ''
}

// ── Guidance sections that must NEVER yield a job title ───────────────────────
const GUIDANCE_HEADERS = [
  'search guidance', 'nice-to-have source signals', 'source signals',
  'likely false positives', 'false positives', 'source lanes', 'source lane',
  'approved workflows', 'how to search', 'sourcing notes', 'recruiter notes',
  'tools to use', 'tooling', 'boolean', 'x-ray', 'xray',
]

// ── Phrases where a title match must be IGNORED (operational tools/instructions) ─
const OPERATIONAL_TITLE_PHRASES = [
  'linkedin recruiter', 'internal recruiter', 'recruiter should', 'recruiter will',
  'sourcer should', 'sourcer will', 'clearancejobs', 'internal ats', 'job posting',
  'staffing ads', 'boolean generator', 'x-ray search', 'xray search',
  'hireez', 'seekout', 'gem', 'ashby', 'apollo', 'lusha', 'contactout', 'gem.com',
]

/** Returns the portion of the JD before any guidance/sourcing section. */
function titleSearchRegion(text: string): string {
  const lower = text.toLowerCase()
  let cut = text.length
  for (const h of GUIDANCE_HEADERS) {
    const idx = lower.indexOf(h)
    if (idx !== -1 && idx < cut) cut = idx
  }
  return text.slice(0, cut)
}

/** True when a title alias appears only inside an operational-tool phrase. */
function isOperationalContext(text: string, alias: string): boolean {
  const lower = text.toLowerCase()
  for (const phrase of OPERATIONAL_TITLE_PHRASES) {
    if (phrase.includes(alias) && lower.includes(phrase)) {
      // The alias only appears as part of an operational phrase — check if it ever appears standalone
      const standalone = new RegExp(`(^|[^a-z])${alias}([^a-z]|$)`, 'i')
      // Remove all operational phrase occurrences, then test for standalone
      let stripped = lower
      for (const p of OPERATIONAL_TITLE_PHRASES) stripped = stripped.split(p).join(' ')
      if (!standalone.test(stripped)) return true
    }
  }
  return false
}

// ── Extract a role title from the JD (section-aware, position-aware) ──────────
function detectRoleTitle(text: string, recognized: Recognized[]): string {
  // 1. Explicit labeled title — highest priority
  const labelMatch = text.match(/(?:^|\n)\s*(?:job\s*title|role|position|title)\s*[:\-]\s*(.+)/i)
  if (labelMatch && labelMatch[1].trim().length > 2) {
    return labelMatch[1].trim().split(/\s{2,}|[|•]/)[0].trim().slice(0, 80)
  }

  // 2. First meaningful line at the very top of the JD (before any guidance section)
  const region = titleSearchRegion(text)
  const topLines = region.split('\n').map(l => l.trim()).filter(Boolean).slice(0, 4)
  for (const line of topLines) {
    if (line.length < 4 || line.length > 80) continue
    const lower = line.toLowerCase()
    // Skip lines that are headers or contain operational phrases
    if (OPERATIONAL_TITLE_PHRASES.some(p => lower.includes(p))) continue
    if (/^(about|overview|summary|responsibilities|requirements|qualifications)\b/.test(lower)) continue
    // A title line usually has role-ish words or matches a taxonomy title
    const looksLikeTitle = /(engineer|developer|recruiter|sourcer|manager|analyst|architect|designer|scientist|lead|specialist|administrator|consultant)/i.test(line)
    if (looksLikeTitle) return line
  }

  // 3. Taxonomy title — but ONLY from the non-guidance region and not operational context
  const regionLower = region.toLowerCase()
  for (const r of recognized) {
    if (r.type !== 'title') continue
    // Must actually appear in the title region (not just guidance)
    const aliasInRegion = regionLower.includes(r.canonical.toLowerCase())
    if (!aliasInRegion) continue
    if (isOperationalContext(text, r.canonical.toLowerCase())) continue
    return r.canonical
  }

  // 4. Last resort: first non-empty meaningful line
  const firstLine = region.split('\n').map(l => l.trim()).find(l => l.length > 3 && l.length < 80)
  return firstLine || ''
}

// ── Extract URLs / links ──────────────────────────────────────────────────────
function extractLinks(text: string): string[] {
  const matches = text.match(/https?:\/\/[^\s)]+/g) || []
  return [...new Set(matches)].slice(0, 8)
}

// ── Extract public emails (resume only — stored unverified) ───────────────────
function extractEmails(text: string): string[] {
  const matches = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || []
  return [...new Set(matches)].slice(0, 3)
}

// ── Main JD parser ────────────────────────────────────────────────────────────
export function parseJobDescription(text: string): ParsedJD {
  const recognized = recognizeEntities(text)

  const skills = recognized.filter(r => r.type === 'skill').map(r => r.canonical)
  const tools = recognized.filter(r => r.type === 'tool').map(r => r.canonical)
  const clearance = recognized.filter(r => r.type === 'clearance').map(r => r.canonical)
  const industries = recognized.filter(r => r.type === 'industry').map(r => r.canonical)
  const companies = recognized.filter(r => r.type === 'company').map(r => r.canonical)
  const titles = recognized.filter(r => r.type === 'title').map(r => r.canonical)

  // Must-have vs preferred by section
  const mustSection = extractSection(text, ['required', 'must have', 'must-have', 'qualifications', 'requirements'], ['preferred', 'nice to have', 'nice-to-have', 'bonus'])
  const prefSection = extractSection(text, ['preferred', 'nice to have', 'nice-to-have', 'bonus', 'plus'], ['required', 'responsibilities', 'about'])
  const mustEntities = mustSection ? recognizeEntities(mustSection).filter(r => r.type === 'skill' || r.type === 'tool').map(r => r.canonical) : []
  const prefEntitiesRaw = prefSection ? recognizeEntities(prefSection).filter(r => r.type === 'skill' || r.type === 'tool').map(r => r.canonical) : []
  // Preferred excludes anything already in must-have
  const prefEntities = prefEntitiesRaw.filter(p => !mustEntities.includes(p))

  const allTech = [...new Set([...skills, ...tools])]
  const mustHaveSkills = mustEntities.length > 0 ? mustEntities : allTech.slice(0, Math.ceil(allTech.length / 2))
  const preferredSkills = prefEntities.length > 0 ? prefEntities : allTech.slice(Math.ceil(allTech.length / 2))

  const roleTitle = detectRoleTitle(text, recognized)
  const seniority = detectSeniority(text)
  const location = recognized.find(r => r.type === 'location')?.canonical || ''

  // Related titles from expansions
  const relatedTitles = titles.flatMap(t => (EXPANSIONS[t.toLowerCase()] || []).slice(0, 4))

  // False positives based on detected entities
  const likelyFalsePositives: string[] = ['bootcamp', 'tutorial', 'course', 'job posting', 'hiring']
  if (clearance.length > 0) likelyFalsePositives.push('Public clearance mentions are unverified — confirm directly')
  if (allTech.includes('Epic')) likelyFalsePositives.push('"Epic" may mean the word, not Epic Systems')
  if (roleTitle.toLowerCase().includes('front end') || roleTitle.toLowerCase().includes('frontend')) {
    likelyFalsePositives.push('WordPress-only', 'UI designer-only (non-engineering)')
  }

  // Suggested Boolean terms — prefer must-haves
  const suggestedBooleanTerms = (mustHaveSkills.length > 0 ? mustHaveSkills : allTech).slice(0, 6)

  // Source lanes
  const suggestedSourceLanes: string[] = ['github']
  if (industries.includes('Healthcare') || tools.includes('Epic')) suggestedSourceLanes.push('npi', 'pubmed')
  if (industries.includes('AI/ML') || tools.includes('PyTorch') || tools.includes('Hugging Face')) suggestedSourceLanes.push('huggingface', 'openalex')
  if (allTech.some(s => ['React', 'TypeScript', 'Node.js', 'JavaScript', 'Vue', 'Angular'].includes(s))) suggestedSourceLanes.push('npm')
  if (allTech.includes('Python')) suggestedSourceLanes.push('pypi')

  // Composer query — title + location + clearance + MUST-HAVE SKILLS.
  // Skills are what drive the live source query (query builder strips clearance/location).
  const skillTerms = (mustHaveSkills.length > 0 ? mustHaveSkills : allTech).slice(0, 4)
  const composerQuery = [roleTitle, location, ...clearance, ...skillTerms].filter(Boolean).join(' ')

  return {
    roleTitle,
    mustHaveSkills,
    preferredSkills,
    tools,
    seniority,
    location,
    clearance,
    industries,
    targetCompanies: companies,
    relatedTitles: [...new Set(relatedTitles)],
    likelyFalsePositives,
    suggestedBooleanTerms,
    suggestedSourceLanes: [...new Set(suggestedSourceLanes)],
    composerQuery,
  }
}

// ── Main resume parser ────────────────────────────────────────────────────────
export function parseResume(text: string): ParsedResume {
  const recognized = recognizeEntities(text)
  const skills = recognized.filter(r => r.type === 'skill').map(r => r.canonical)
  const tools = recognized.filter(r => r.type === 'tool').map(r => r.canonical)
  const companies = recognized.filter(r => r.type === 'company').map(r => r.canonical)
  const currentTitle = recognized.find(r => r.type === 'title')?.canonical || ''
  const location = recognized.find(r => r.type === 'location')?.canonical || ''
  const links = extractLinks(text)
  const emails = extractEmails(text)

  const contactSignals = emails.map(e => ({
    type: 'public_email',
    value: e,
    note: 'Parsed from pasted resume — UNVERIFIED. Confirm before any outreach.',
  }))

  // Evidence snippets — lines mentioning recognized skills
  const evidenceSnippets = text.split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 20 && l.length < 200 && [...skills, ...tools].some(s => l.toLowerCase().includes(s.toLowerCase())))
    .slice(0, 4)

  return {
    currentTitle,
    companies,
    skills,
    tools,
    location,
    links,
    contactSignals,
    evidenceSnippets,
  }
}
