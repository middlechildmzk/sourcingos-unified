// ─────────────────────────────────────────────────────────────────────────────
// lib/search-assist.ts — Deterministic recruiter search-assist.
//
// V36.3 recognizes/typeaheads from the shared Entity Intelligence registry.
// Legacy EXPANSIONS remain a compatibility discovery layer, but reviewed graph
// relationships are preferred and neither expansion source becomes candidate
// evidence. Public technical lanes filter clearance/location terms.
// ─────────────────────────────────────────────────────────────────────────────
import type { EntityType } from '@/data/search-taxonomy'
import { EXPANSIONS, ALL_SOURCE_LANES } from '@/data/search-expansions'
import {
  ENTITY_REGISTRY_V35,
  matchEntitiesV35,
  suggestRelatedEntitiesV35,
} from '@/lib/entity-intelligence/registry-v35'
import type { EntityKind, IntelligenceEntity } from '@/lib/entity-intelligence/types-v35'

export type SuggestionKind =
  | 'title'
  | 'skill'
  | 'tool'
  | 'credential'
  | 'industry'
  | 'clearance'
  | 'location'
  | 'company'
  | 'source-lane'
  | 'exclusion'
  | 'operator'
  | 'related'

export interface Suggestion {
  value: string
  kind: SuggestionKind
  reason: string
  rank: number
}

export interface AssistResult {
  recognized: { canonical: string; type: EntityType }[]
  suggestions: Suggestion[]
  notes: string[]
}

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

const HEALTHCARE_IT_TERMS = ['Epic', 'Cerner', 'HL7', 'FHIR', 'EMR', 'EHR', 'Meditech', 'Interoperability']
const RECRUITING_TERMS = ['Talent Sourcer', 'Technical Recruiter', 'Talent Acquisition', 'Recruiting Coordinator', 'TA Partner', 'Recruitment Marketing']
const STANDARD_EXCLUSIONS = ['jobs', 'hiring', 'recruiter', 'training', 'student', 'course', 'bootcamp']
const LANE_LABEL: Record<string, string> = Object.fromEntries(ALL_SOURCE_LANES.map(l => [l.id, l.name]))
const LOCATION_KINDS = new Set<EntityKind>(['location', 'place', 'metro', 'region', 'postal_area', 'country', 'state', 'county'])

function entityTypeFor(kind: EntityKind): EntityType {
  if (kind === 'occupation') return 'title'
  if (kind === 'technology') return 'tool'
  if (kind === 'credential') return 'certification'
  if (LOCATION_KINDS.has(kind)) return 'location'
  if (kind === 'title' || kind === 'skill' || kind === 'tool' || kind === 'certification' || kind === 'location' || kind === 'clearance' || kind === 'company' || kind === 'industry' || kind === 'seniority' || kind === 'employment-signal' || kind === 'source') return kind
  return 'skill'
}

function suggestionKindFor(kind: EntityKind): SuggestionKind {
  if (kind === 'occupation' || kind === 'title') return 'title'
  if (kind === 'technology' || kind === 'tool') return 'tool'
  if (kind === 'credential' || kind === 'certification') return 'credential'
  if (LOCATION_KINDS.has(kind)) return 'location'
  if (kind === 'clearance') return 'clearance'
  if (kind === 'company') return 'company'
  if (kind === 'industry') return 'industry'
  if (kind === 'skill') return 'skill'
  return 'related'
}

function reviewed(entity: IntelligenceEntity): boolean {
  return entity.provenance.some(item => item.reviewState === 'reviewed')
}

function recognize(input: string): { canonical: string; type: EntityType; entity: IntelligenceEntity }[] {
  const out: { canonical: string; type: EntityType; entity: IntelligenceEntity }[] = []
  const seen = new Set<string>()
  for (const match of matchEntitiesV35(input)) {
    // Unreviewed legacy aliases remain visible as search intelligence elsewhere,
    // but are not silently normalized into the recruiter interpretation.
    if (match.activation === 'suggested_inactive') continue
    if (seen.has(match.entity.id)) continue
    seen.add(match.entity.id)
    out.push({ canonical: match.entity.canonicalLabel, type: entityTypeFor(match.entity.kind), entity: match.entity })
  }
  return out
}

function activeToken(input: string): string {
  const m = input.match(/([A-Za-z0-9+#./-]+)$/)
  return m ? m[1].toLowerCase() : ''
}

function expansionTerms(entity: IntelligenceEntity): string[] {
  const keys = Array.from(new Set([entity.canonicalLabel.toLowerCase(), ...entity.aliases]))
  return Array.from(new Set(keys.flatMap(key => EXPANSIONS[key] || [])))
}

function typeaheadEntities(token: string): IntelligenceEntity[] {
  if (token.length < 2) return []
  // Bare TS is intentionally ambiguous between TypeScript and Top Secret.
  if (token === 'ts') return []

  return ENTITY_REGISTRY_V35.entities
    .filter(entity => {
      if (reviewed(entity)) return [entity.canonicalLabel.toLowerCase(), ...entity.aliases].some(value => value.startsWith(token))
      // Legacy dictionaries have mixed alias semantics. Their canonical labels
      // can still typeahead, but unreviewed aliases cannot silently normalize.
      return entity.canonicalLabel.toLowerCase().startsWith(token)
    })
    .sort((a, b) => {
      const aExactPrefix = a.canonicalLabel.toLowerCase().startsWith(token) ? 0 : 1
      const bExactPrefix = b.canonicalLabel.toLowerCase().startsWith(token) ? 0 : 1
      return aExactPrefix - bExactPrefix || a.canonicalLabel.localeCompare(b.canonicalLabel)
    })
}

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
  const isHealthcare = recognized.some(r => /healthcare|epic|cerner|oracle health|hl7|fhir/i.test(r.canonical))
  const isGovCon = hasClearance || recognized.some(r => /govcon|federal government contracting/i.test(r.canonical))
  const isRecruitingSearch = recognized.some(r => /sourcer|recruiter|talent acquisition/i.test(r.canonical))

  const out: Suggestion[] = []
  const push = (s: Suggestion) => {
    const key = s.value.toLowerCase()
    if (present.has(key) || added.has(key)) return
    if (isGithubLane && (s.kind === 'clearance' || s.kind === 'location' || s.kind === 'exclusion')) return
    if (out.some(o => o.value.toLowerCase() === key && o.kind === s.kind)) return
    out.push(s)
  }

  // 1) Registry-backed categorized typeahead.
  for (const entity of typeaheadEntities(token).slice(0, 12)) {
    push({
      value: entity.canonicalLabel,
      kind: suggestionKindFor(entity.kind),
      reason: reviewed(entity) ? `reviewed ${entity.kind} match for "${token}"` : `canonical match for "${token}"`,
      rank: 0,
    })
  }

  // 2) Reviewed graph adjacency. Related concepts are search helpers only.
  for (const r of recognized) {
    // Never broaden one clearance concept into another. Clearance floors are
    // recruiter requirements/verification gates, not "Find Similar" fodder.
    if (r.type === 'clearance') continue
    for (const related of suggestRelatedEntitiesV35(r.entity.id).slice(0, 6)) {
      if (related.entity.kind === 'clearance') continue
      push({
        value: related.entity.canonicalLabel,
        kind: suggestionKindFor(related.entity.kind),
        reason: related.relationship?.note || `search adjacency to ${r.canonical}`,
        rank: related.relationship?.provenance.some(p => p.reviewState === 'reviewed') ? 1 : 2.4,
      })
    }
  }

  // 3) Legacy expansion compatibility. These are discovery suggestions, never
  // normalization or candidate qualification evidence.
  for (const r of recognized) {
    const exps = expansionTerms(r.entity).filter(e => e.toLowerCase() !== r.canonical.toLowerCase())
    exps.slice(0, 5).forEach((e, i) => {
      const kind: SuggestionKind = r.type === 'title' ? 'title' : (r.type === 'skill' || r.type === 'tool') ? 'skill' : 'related'
      push({ value: e, kind, reason: `legacy discovery adjacency to ${r.canonical}`, rank: 2.5 + i * 0.1 })
    })
  }

  // 4) Adaptive combination rules retained for recruiter usefulness.
  if (hasTitle && !hasSkill) {
    for (const r of recognized.filter(r => r.type === 'title')) {
      expansionTerms(r.entity)
        .filter(e => e.toLowerCase() !== r.canonical.toLowerCase())
        .slice(0, 4)
        .forEach((e, i) => push({ value: e, kind: 'skill', reason: `common discovery term for ${r.canonical}`, rank: 2 + i * 0.1 }))
    }
  }

  if (isHealthcare) {
    HEALTHCARE_IT_TERMS.forEach((t, i) => push({ value: t, kind: 'skill', reason: 'healthcare IT discovery stack', rank: 3 + i * 0.1 }))
  }

  if (isRecruitingSearch) {
    RECRUITING_TERMS.forEach((t, i) => push({ value: t, kind: 'title', reason: 'recruiting/TA variant', rank: 2 + i * 0.1 }))
  }

  // 5) Nearby cleared markets. This is sourcing-area expansion only; it never
  // asserts candidate residence or willingness to commute.
  const lowerInput = input.toLowerCase()
  if (hasLocation || isGovCon || /\b(secret|ts\/sci|clearance|cleared)\b/.test(lowerInput)) {
    for (const r of recognized.filter(r => r.type === 'location')) {
      const keys = [r.canonical.toLowerCase(), ...r.entity.aliases]
      for (const key of keys) {
        const near = CLEARED_MARKET_ADJACENCY[key]
        if (near) near.forEach((m, i) => push({ value: m, kind: 'location', reason: `near ${r.canonical}`, rank: 2 + i * 0.1 }))
      }
    }
    for (const [hint, markets] of Object.entries(CLEARED_MARKET_ADJACENCY)) {
      if (lowerInput.includes(hint)) markets.forEach((m, i) => push({ value: m, kind: 'location', reason: `near ${hint}`, rank: 2.5 + i * 0.1 }))
    }
  }

  // 6) Source-lane suggestions.
  const clearedHint = isGovCon || /\b(secret|ts\/sci|ts sci|poly|clearance|cleared)\b/.test(lowerInput)
  const laneSuggest: { id: string; reason: string }[] = []
  if (clearedHint) laneSuggest.push({ id: 'clearancejobs', reason: 'cleared talent' }, { id: 'usajobs', reason: 'federal roles' })
  if (hasSkill || hasTitle) laneSuggest.push({ id: 'linkedin-xray', reason: 'broad reach' }, { id: 'github', reason: 'technical evidence' })
  if (isHealthcare) laneSuggest.push({ id: 'npi', reason: 'provider registry' }, { id: 'pubmed', reason: 'clinical publications' })
  if (recognized.some(r => /pytorch|tensorflow|hugging face|large language models|llm/i.test(r.canonical))) laneSuggest.push({ id: 'huggingface', reason: 'model authors' }, { id: 'arxiv', reason: 'AI research' })
  for (const { id, reason } of laneSuggest) {
    if (LANE_LABEL[id]) push({ value: LANE_LABEL[id], kind: 'source-lane', reason, rank: 4 })
  }

  // 7) Exclusions and operator helpers.
  if ((hasTitle || hasSkill) && !isGithubLane) {
    STANDARD_EXCLUSIONS.slice(0, 4).forEach((x, i) => push({ value: x, kind: 'exclusion', reason: 'reduce noise', rank: 6 + i * 0.1 }))
  }
  if (recognized.length >= 2 && !/\b(AND|OR|NOT)\b/.test(input)) {
    push({ value: 'AND', kind: 'operator', reason: 'combine required terms', rank: 7 })
  }

  const rawClearedHint = /\b(secret|ts\/sci|ts sci|top secret|poly|polygraph|clearance|cleared)\b/.test(lowerInput)
  const notes: string[] = [
    'Suggestions are search helpers, not verified candidate facts.',
    'Adjacent titles, technologies and credentials do not satisfy must-haves without candidate evidence.',
  ]
  if (hasClearance || rawClearedHint) {
    notes.push('Clearance must be confirmed through the proper process.')
    notes.push('Public X-Ray cannot verify clearance — keep clearance terms in authorized professional / cleared-market lanes.')
  }
  if (isGithubLane) notes.push('GitHub signals public technical evidence, not full candidate fit. Clearance, location, and HR terms are excluded from this lane.')

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

export function groupSuggestions(suggestions: Suggestion[]): { kind: SuggestionKind; label: string; items: Suggestion[] }[] {
  const LABELS: Record<SuggestionKind, string> = {
    title: 'Titles', skill: 'Skills', tool: 'Tools', credential: 'Credentials', industry: 'Industries', clearance: 'Clearance',
    location: 'Locations / markets', company: 'Companies', 'source-lane': 'Source lanes', exclusion: 'Exclusions', operator: 'Operators', related: 'Related terms',
  }
  const order: SuggestionKind[] = ['title', 'skill', 'tool', 'credential', 'industry', 'location', 'clearance', 'company', 'related', 'source-lane', 'exclusion', 'operator']
  const groups: { kind: SuggestionKind; label: string; items: Suggestion[] }[] = []
  for (const kind of order) {
    const items = suggestions.filter(s => s.kind === kind)
    if (items.length) groups.push({ kind, label: LABELS[kind], items })
  }
  return groups
}
