// ─────────────────────────────────────────────────────────────────────────────
// lib/search-assist.ts — Deterministic search-assist suggestion engine.
//
// Powers the candidate-search typeahead. Pure functions, client-safe, no AI, no
// network, no new deps. Builds on the existing taxonomy + expansions:
//   • ALL_TAXONOMY        (entity recognition dictionary)
//   • EXPANSIONS          (title/skill adjacency map)
//   • ALL_SOURCE_LANES    (source lane catalog)
//
// Adds, on top of repo data:
//   • nearby cleared-market adjacency (Fort Meade → Annapolis Junction, etc.)
//   • adaptive cross-suggestions (DevSecOps → Terraform/AWS; healthcare → HL7)
//   • lane-aware filtering (GitHub query never gets clearance/location/soft terms)
//   • partial-token typeahead matching against taxonomy aliases
//
// Trust posture: every suggestion is a *search helper*, never a candidate fact.
// Clearance is never auto-suggested into a public X-Ray / GitHub lane.
// ─────────────────────────────────────────────────────────────────────────────
import { ALL_TAXONOMY, type EntityType, type TaxonomyEntry } from '@/data/search-taxonomy'
import { EXPANSIONS, ALL_SOURCE_LANES } from '@/data/search-expansions'

export type SuggestionKind =
  | 'title'
  | 'skill'
  | 'tool'
  | 'clearance'
  | 'location'
  | 'company'
  | 'source-lane'
  | 'exclusion'
  | 'operator'
  | 'related'

export interface Suggestion {
  /** The term to add to the query (or operator snippet). */
  value: string
  kind: SuggestionKind
  /** Short reason shown in the dropdown ("adjacent to DevSecOps"). */
  reason: string
  /** Lower = higher in the list. */
  rank: number
}

export interface AssistResult {
  /** Entities recognized in the current input (for the interpretation panel). */
  recognized: { canonical: string; type: EntityType }[]
  suggestions: Suggestion[]
  /** Trust/caution notes relevant to the current input. */
  notes: string[]
}

// ─── Cleared-market adjacency (self-contained; no taxonomy edits) ─────────────
// Maps a recognized market hint → nearby cleared markets a sourcer should add.
const CLEARED_MARKET_ADJACENCY: Record<string, string[]> = {
  'fort meade': ['Annapolis Junction', 'Columbia MD', 'Hanover MD', 'BWI corridor', 'DC Metro'],
  'meade': ['Annapolis Junction', 'Columbia MD', 'Hanover MD', 'BWI corridor'],
  'annapolis junction': ['Fort Meade', 'Columbia MD', 'Hanover MD'],
  'huntsville': ['Redstone Arsenal', 'Madison AL', 'Cummings Research Park'],
  'san antonio': ['Lackland AFB', 'JBSA', 'Port San Antonio'],
  'colorado springs': ['Peterson SFB', 'Schriever SFB', 'Aurora CO', 'Denver Tech Center'],
  'aurora': ['Buckley SFB', 'Denver', 'Colorado Springs'],
  'tampa': ['MacDill AFB', 'St Petersburg FL', 'Brandon FL'],
  'northern virginia': ['Chantilly', 'Reston', 'Herndon', 'Dulles corridor', 'Springfield VA'],
  'nova': ['Chantilly', 'Reston', 'Herndon', 'Dulles corridor'],
  'dc': ['Northern Virginia', 'Bethesda', 'Fort Meade corridor'],
  'washington dc': ['Northern Virginia', 'Bethesda', 'Fort Meade corridor'],
}

// Healthcare-IT adjacency that isn't fully covered by EXPANSIONS.
const HEALTHCARE_IT_TERMS = ['Epic', 'Cerner', 'HL7', 'FHIR', 'EMR', 'EHR', 'Meditech', 'Interoperability']

// Recruiting/TA adjacency (so a sourcer search doesn't get engineering skills).
const RECRUITING_TERMS = ['Talent Sourcer', 'Technical Recruiter', 'Talent Acquisition', 'Recruiting Coordinator', 'TA Partner', 'Recruitment Marketing']

// Standard exclusions that improve almost any people-search.
const STANDARD_EXCLUSIONS = ['jobs', 'hiring', 'recruiter', 'training', 'student', 'course', 'bootcamp']

// Source lanes keyed by what's in the query.
const LANE_LABEL: Record<string, string> = Object.fromEntries(ALL_SOURCE_LANES.map(l => [l.id, l.name]))

// ─── Recognition (reuses the taxonomy used by SearchComposer) ─────────────────
function recognize(input: string): { canonical: string; type: EntityType; entry: TaxonomyEntry }[] {
  const lower = ` ${input.toLowerCase()} `
  const found: { canonical: string; type: EntityType; entry: TaxonomyEntry }[] = []
  const seen = new Set<string>()
  for (const entry of ALL_TAXONOMY) {
    for (const alias of entry.aliases) {
      // word-ish boundary match to avoid partial-substring noise
      if (lower.includes(` ${alias} `) || lower.includes(` ${alias}`) || lower.includes(`${alias} `)) {
        if (!seen.has(entry.canonical)) {
          seen.add(entry.canonical)
          found.push({ canonical: entry.canonical, type: entry.type, entry })
        }
        break
      }
    }
  }
  return found
}

/** Last whitespace-delimited token the user is mid-typing (for typeahead). */
function activeToken(input: string): string {
  const m = input.match(/([A-Za-z0-9+#./-]+)$/)
  return m ? m[1].toLowerCase() : ''
}

// ─── Main entry point ─────────────────────────────────────────────────────────
export function getSearchAssistSuggestions(
  input: string,
  opts: { selectedLaneId?: string; alreadyAdded?: string[] } = {}
): AssistResult {
  const recognized = recognize(input)
  const present = new Set(recognized.map(r => r.canonical.toLowerCase()))
  const added = new Set((opts.alreadyAdded || []).map(s => s.toLowerCase()))
  const token = activeToken(input)
  const lane = opts.selectedLaneId
  const isGithubLane = lane === 'github'

  const types = new Set(recognized.map(r => r.type))
  const hasTitle = types.has('title')
  const hasClearance = types.has('clearance')
  const hasSkill = types.has('skill') || types.has('tool')
  const hasLocation = types.has('location')
  const isHealthcare = recognized.some(r => r.canonical === 'Healthcare' || r.canonical === 'Epic' || r.canonical === 'Cerner')
  const isGovCon = hasClearance || recognized.some(r => r.canonical === 'GovCon')
  const isRecruitingSearch = recognized.some(r => /sourcer|recruiter|talent acquisition/i.test(r.canonical))

  const out: Suggestion[] = []
  const push = (s: Suggestion) => {
    const key = s.value.toLowerCase()
    if (present.has(key) || added.has(key)) return
    // Lane-aware filtering: GitHub query is skills/tools only.
    if (isGithubLane && (s.kind === 'clearance' || s.kind === 'location' || s.kind === 'exclusion')) return
    if (out.some(o => o.value.toLowerCase() === key && o.kind === s.kind)) return
    out.push(s)
  }

  // 1) Typeahead: partial-token matches against taxonomy aliases.
  if (token.length >= 2) {
    for (const entry of ALL_TAXONOMY) {
      if (present.has(entry.canonical.toLowerCase())) continue
      const hit = entry.aliases.some(a => a.startsWith(token)) || entry.canonical.toLowerCase().startsWith(token)
      if (hit) {
        push({
          value: entry.canonical,
          kind: (entry.type === 'industry' || entry.type === 'seniority' || entry.type === 'employment-signal' || entry.type === 'company' || entry.type === 'certification' || entry.type === 'source') ? 'related' : (entry.type as SuggestionKind),
          reason: `matches "${token}"`,
          rank: 0,
        })
      }
    }
  }

  // 2) Adjacent titles + skills from EXPANSIONS for each recognized entity.
  for (const r of recognized) {
    const exps = (EXPANSIONS[r.canonical.toLowerCase()] || []).filter(
      e => e.toLowerCase() !== r.canonical.toLowerCase()
    )
    exps.slice(0, 5).forEach((e, i) => {
      const kind: SuggestionKind = r.type === 'title' ? 'title' : (r.type === 'skill' || r.type === 'tool') ? 'skill' : 'related'
      push({ value: e, kind, reason: `adjacent to ${r.canonical}`, rank: 2 + i * 0.1 })
    })
  }

  // 3) Adaptive combination rules.
  if (hasTitle && !hasSkill) {
    // Title with no skills yet — pull the title's strongest skill adjacents.
    for (const r of recognized.filter(r => r.type === 'title')) {
      (EXPANSIONS[r.canonical.toLowerCase()] || [])
        .filter(e => e.toLowerCase() !== r.canonical.toLowerCase())
        .slice(0, 4).forEach((e, i) =>
        push({ value: e, kind: 'skill', reason: `common for ${r.canonical}`, rank: 1.5 + i * 0.1 }))
    }
  }

  if (isHealthcare) {
    HEALTHCARE_IT_TERMS.forEach((t, i) => push({ value: t, kind: 'skill', reason: 'healthcare IT stack', rank: 3 + i * 0.1 }))
  }

  if (isRecruitingSearch) {
    // Recruiting search: suggest TA variants, NOT engineering skills.
    RECRUITING_TERMS.forEach((t, i) => push({ value: t, kind: 'title', reason: 'recruiting/TA variant', rank: 2 + i * 0.1 }))
  }

  // 4) Nearby cleared markets. Triggered by recognized locations OR any raw
  //    market hint in the text (some markets aren't in the core taxonomy).
  const lowerInput = input.toLowerCase()
  if (hasLocation || isGovCon || /\b(secret|ts\/sci|clearance|cleared)\b/.test(lowerInput)) {
    for (const r of recognized.filter(r => r.type === 'location')) {
      const near = CLEARED_MARKET_ADJACENCY[r.canonical.toLowerCase()]
      if (near) near.forEach((m, i) => push({ value: m, kind: 'location', reason: `near ${r.canonical}`, rank: 2 + i * 0.1 }))
    }
    for (const [hint, markets] of Object.entries(CLEARED_MARKET_ADJACENCY)) {
      if (lowerInput.includes(hint)) markets.forEach((m, i) => push({ value: m, kind: 'location', reason: `near ${hint}`, rank: 2.5 + i * 0.1 }))
    }
  }

  // 5) Source-lane suggestions (adaptive to entities). Ranked above exclusions
  //    so cleared lanes survive the cap on dense cleared queries.
  const lowerForLanes = input.toLowerCase()
  const clearedHint = isGovCon || /\b(secret|ts\/sci|ts sci|poly|clearance|cleared)\b/.test(lowerForLanes)
  const laneSuggest: { id: string; reason: string }[] = []
  if (clearedHint) { laneSuggest.push({ id: 'clearancejobs', reason: 'cleared talent' }, { id: 'usajobs', reason: 'federal roles' }) }
  if (hasSkill || hasTitle) { laneSuggest.push({ id: 'linkedin-xray', reason: 'broad reach' }, { id: 'github', reason: 'technical evidence' }) }
  if (isHealthcare) laneSuggest.push({ id: 'npi', reason: 'provider registry' }, { id: 'pubmed', reason: 'clinical publications' })
  if (recognized.some(r => ['PyTorch', 'TensorFlow', 'Hugging Face', 'LLM'].includes(r.canonical))) laneSuggest.push({ id: 'huggingface', reason: 'model authors' }, { id: 'arxiv', reason: 'AI research' })
  for (const { id, reason } of laneSuggest) {
    if (LANE_LABEL[id]) push({ value: LANE_LABEL[id], kind: 'source-lane', reason, rank: 4 })
  }

  // 6) Exclusions (skip on GitHub lane).
  if ((hasTitle || hasSkill) && !isGithubLane) {
    STANDARD_EXCLUSIONS.slice(0, 4).forEach((x, i) => push({ value: x, kind: 'exclusion', reason: 'reduce noise', rank: 6 + i * 0.1 }))
  }

  // 7) Operator hint once there are ≥2 recognized entities.
  if (recognized.length >= 2 && !/\b(AND|OR|NOT)\b/.test(input)) {
    push({ value: 'AND', kind: 'operator', reason: 'combine required terms', rank: 7 })
  }

  // ─── Notes (trust + caution) ────────────────────────────────────────────────
  const rawClearedHint = /\b(secret|ts\/sci|ts sci|top secret|poly|polygraph|clearance|cleared)\b/.test(input.toLowerCase())
  const notes: string[] = ['Suggestions are search helpers, not verified candidate facts.']
  if (hasClearance || rawClearedHint) {
    notes.push('Clearance must be confirmed through the proper process.')
    notes.push('Public X-Ray cannot verify clearance — keep clearance terms in LinkedIn Recruiter / ClearanceJobs lanes.')
  }
  if (isGithubLane) notes.push('GitHub signals technical evidence, not full candidate fit. Clearance, location, and HR terms are excluded from this lane.')

  out.sort((a, b) => a.rank - b.rank)
  const CAP = 28
  const lanes = out.filter(s => s.kind === 'source-lane')
  const rest = out.filter(s => s.kind !== 'source-lane').slice(0, Math.max(0, CAP - lanes.length))
  const capped = [...lanes, ...rest].sort((a, b) => a.rank - b.rank)
  return {
    recognized: recognized.map(r => ({ canonical: r.canonical, type: r.type })),
    suggestions: capped,
    notes,
  }
}

/** Group suggestions by kind for the dropdown UI, preserving rank order. */
export function groupSuggestions(suggestions: Suggestion[]): { kind: SuggestionKind; label: string; items: Suggestion[] }[] {
  const LABELS: Record<SuggestionKind, string> = {
    title: 'Titles', skill: 'Skills', tool: 'Tools', clearance: 'Clearance',
    location: 'Locations / markets', company: 'Companies', 'source-lane': 'Source lanes',
    exclusion: 'Exclusions', operator: 'Operators', related: 'Related terms',
  }
  const order: SuggestionKind[] = ['title', 'skill', 'tool', 'location', 'clearance', 'company', 'related', 'source-lane', 'exclusion', 'operator']
  const groups: { kind: SuggestionKind; label: string; items: Suggestion[] }[] = []
  for (const kind of order) {
    const items = suggestions.filter(s => s.kind === kind)
    if (items.length) groups.push({ kind, label: LABELS[kind], items })
  }
  return groups
}
