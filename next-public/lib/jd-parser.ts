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

// ── Extract a role title from the first lines ─────────────────────────────────
function detectRoleTitle(text: string, recognized: Recognized[]): string {
  const titleEntity = recognized.find(r => r.type === 'title')
  if (titleEntity) return titleEntity.canonical
  // Fallback: first non-empty line, trimmed
  const firstLine = text.split('\n').map(l => l.trim()).find(l => l.length > 3 && l.length < 80)
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
