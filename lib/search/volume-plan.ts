import { allSourceNames, type SourceName } from '@/lib/source-types'

export type SearchMode = 'precision' | 'balanced' | 'broad' | 'market_map'

export type VolumeChip = {
  canonical: string
  type: string
}

export type QueryVariant = {
  id: string
  label: string
  query: string
  note: string
  manualSafe?: boolean
}

export type ManualSafeLane = {
  id: string
  label: string
  href: string
  note: string
}

export type VolumeSearchPlan = {
  mode: SearchMode
  modeLabel: string
  sourceLimit: number
  liveSources: SourceName[]
  manualSafeLanes: ManualSafeLane[]
  queryVariants: QueryVariant[]
  lowResultActions: string[]
}

export type MarketMapSnapshot = {
  mode: SearchMode
  modeLabel: string
  totalResults: number
  liveSources: string[]
  manualSafeLanes: ManualSafeLane[]
  sourceBreakdown: Record<string, number>
  queryVariants: QueryVariant[]
  lowResultActions: string[]
  unverified: string[]
}

const MODE_LABELS: Record<SearchMode, string> = {
  precision: 'Precision',
  balanced: 'Balanced',
  broad: 'Broad',
  market_map: 'Market Map',
}

const MODE_LIMITS: Record<SearchMode, number> = {
  precision: 6,
  balanced: 8,
  broad: 10,
  market_map: 12,
}

const SOURCE_NAME_SET = new Set<string>(allSourceNames)
const CORE_FAST: SourceName[] = ['github', 'npm', 'pypi', 'openalex', 'huggingface']
const BALANCED_EXTRA: SourceName[] = ['stackoverflow', 'devto']
const TECHNICAL: SourceName[] = ['github', 'stackoverflow', 'devto', 'dockerhub', 'npm', 'pypi', 'crates', 'rubygems']
const AI_ML: SourceName[] = ['github', 'huggingface', 'openalex', 'semantic_scholar', 'arxiv', 'pypi', 'kaggle']
const HEALTHCARE: SourceName[] = ['npi', 'pubmed', 'openalex']
const GOVCON_BASE: SourceName[] = ['github', 'stackoverflow', 'devto', 'dockerhub', 'npm', 'pypi', 'resume_xray']
const MARKET_MAP: SourceName[] = ['github', 'stackoverflow', 'devto', 'dockerhub', 'npm', 'pypi', 'crates', 'rubygems', 'openalex', 'semantic_scholar', 'arxiv', 'huggingface', 'npi', 'pubmed', 'orcid', 'resume_xray', 'kaggle']

const AI_TERMS = ['ai', 'ml', 'machine learning', 'llm', 'rag', 'pytorch', 'tensorflow', 'hugging face', 'transformer', 'nlp', 'model']
const HEALTH_TERMS = ['healthcare', 'clinical', 'epic', 'cerner', 'hl7', 'fhir', 'nurse', 'rn', 'hospital', 'claims']
const GOVCON_TERMS = ['ts/sci', 'secret', 'top secret', 'poly', 'clearance', 'rmf', 'ato', 'fedramp', 'govcloud', 'scif', 'dod']

function unique<T>(items: T[]): T[] {
  return Array.from(new Set(items))
}

function isSourceName(value: string): value is SourceName {
  return SOURCE_NAME_SET.has(value)
}

function toSourceNames(values: string[] = []): SourceName[] {
  return unique(values.filter(isSourceName))
}

function lowerText(rawQuery: string, chips: VolumeChip[]): string {
  return `${rawQuery} ${chips.map(c => c.canonical).join(' ')}`.toLowerCase()
}

function chipValues(chips: VolumeChip[], types: string[]) {
  return unique(chips.filter(c => types.includes(c.type)).map(c => c.canonical).filter(Boolean))
}

function hasAny(text: string, terms: string[]) {
  return terms.some(term => text.includes(term))
}

function xrayUrl(query: string) {
  return `https://www.google.com/search?q=${encodeURIComponent(query)}`
}

export function buildManualSafeLanes(rawQuery: string, chips: VolumeChip[]): ManualSafeLane[] {
  const text = lowerText(rawQuery, chips)
  const base = rawQuery.trim()
  const skills = chipValues(chips, ['skill', 'tool', 'certification']).join(' ') || base
  const titles = chipValues(chips, ['title']).map(t => `"${t}"`).join(' OR ')
  const clearances = chipValues(chips, ['clearance']).map(t => `"${t}"`).join(' OR ')

  const lanes: ManualSafeLane[] = [
    {
      id: 'resume-xray',
      label: 'Public Resume X-Ray',
      href: xrayUrl(`("resume" OR "cv") (${base}) (filetype:pdf OR filetype:doc OR filetype:docx OR intitle:resume OR inurl:resume)`),
      note: 'Manual-safe discovery lane. Opens public search results for recruiter review. No scraping, no auto-import.',
    },
    {
      id: 'portfolio-xray',
      label: 'Portfolio / personal site X-Ray',
      href: xrayUrl(`(${titles || base}) ${skills} (portfolio OR "personal website" OR "about me" OR projects) -jobs -hiring`),
      note: 'Manual-safe open-web search for portfolios and personal sites. Every result requires manual review.',
    },
    {
      id: 'conference-xray',
      label: 'Conference speaker X-Ray',
      href: xrayUrl(`(${base}) (speaker OR conference OR meetup OR webinar OR talk OR presentation) -jobs -hiring`),
      note: 'Manual-safe discovery lane for public talks and conference pages, not candidate verification.',
    },
    {
      id: 'github-profile-xray',
      label: 'GitHub profile X-Ray',
      href: xrayUrl(`site:github.com (${base}) -jobs -issues -pulls`),
      note: 'Manual-safe GitHub profile discovery. Review source URLs before saving evidence.',
    },
    {
      id: 'linkedin-xray',
      label: 'LinkedIn X-Ray string',
      href: xrayUrl(`site:linkedin.com/in (${titles || base}) ${skills} -jobs -hiring`),
      note: 'Manual-safe X-Ray link only. Do not scrape LinkedIn or automate behind login walls.',
    },
  ]

  if (hasAny(text, GOVCON_TERMS) || clearances) {
    lanes.push({
      id: 'clearance-breadcrumb-xray',
      label: 'GovCon / clearance breadcrumb X-Ray',
      href: xrayUrl(`(${clearances || '"TS/SCI" OR "Secret" OR "Top Secret"'}) (${skills}) (RMF OR ATO OR FedRAMP OR GovCloud OR SCIF OR DoD)`),
      note: 'Clearance language from public text is an unverified breadcrumb only. Verification must happen through authorized channels.',
    })
  }

  if (hasAny(text, AI_TERMS)) {
    lanes.push({
      id: 'kaggle-manual-safe',
      label: 'Kaggle manual-safe search',
      href: `https://www.kaggle.com/search?q=${encodeURIComponent(base)}`,
      note: 'Manual-safe search for public notebooks, datasets, and profiles. No scraping or auto-import.',
    })
  }

  return lanes
}

export function buildQueryVariants(rawQuery: string, chips: VolumeChip[]): QueryVariant[] {
  const titles = chipValues(chips, ['title'])
  const skills = chipValues(chips, ['skill', 'tool', 'certification'])
  const locations = chipValues(chips, ['location'])
  const companies = chipValues(chips, ['company'])
  const clearances = chipValues(chips, ['clearance'])
  const text = lowerText(rawQuery, chips)
  const skillQuery = skills.join(' ')
  const titleQuery = titles.join(' ')
  const locationQuery = locations.join(' ')

  const variants: QueryVariant[] = [
    {
      id: 'exact',
      label: 'Exact role + skills',
      query: [titleQuery, skillQuery, locationQuery].filter(Boolean).join(' ') || rawQuery,
      note: 'Best first pass for relevance. Can be narrow if titles or location are too specific.',
    },
    {
      id: 'skills-only',
      label: 'Skills-only recall',
      query: skillQuery || rawQuery,
      note: 'Removes title and location pressure so public technical sources have more room to return evidence.',
    },
    {
      id: 'broad',
      label: 'Broad source discovery',
      query: [skillQuery, titleQuery].filter(Boolean).join(' ') || rawQuery,
      note: 'Balanced recall lane for source coverage. Results still require recruiter review.',
    },
  ]

  if (companies.length && skills.length) {
    variants.push({
      id: 'donor-company',
      label: 'Donor company + skill',
      query: `${companies.slice(0, 3).join(' OR ')} ${skills.slice(0, 4).join(' ')}`,
      note: 'Useful for donor-company mapping, but company text is a review filter, not proof of current employment.',
    })
  }

  if (hasAny(text, AI_TERMS)) {
    variants.push({ id: 'ai-ml', label: 'AI/ML ecosystem', query: `${skillQuery || rawQuery} Hugging Face PyTorch transformers model dataset paper`, note: 'Routes toward AI/ML public evidence surfaces like Hugging Face, papers, packages, and GitHub.' })
  }

  if (hasAny(text, HEALTH_TERMS)) {
    variants.push({ id: 'healthcare', label: 'Healthcare ecosystem', query: `${skillQuery || rawQuery} healthcare clinical Epic HL7 FHIR`, note: 'Routes toward healthcare/public registry and publication surfaces where appropriate.' })
  }

  if (hasAny(text, GOVCON_TERMS) || clearances.length) {
    variants.push({ id: 'govcon-manual-safe', label: 'GovCon breadcrumb lane', query: `${skillQuery || rawQuery} ${clearances.join(' ')} RMF ATO FedRAMP GovCloud`, note: 'Manual-safe clearance/GovCon discovery. Public clearance text is not verification.', manualSafe: true })
  }

  return variants.filter(v => v.query.trim())
}

export function buildVolumeSearchPlan(input: { rawQuery: string; chips: VolumeChip[]; recommendedSourceIds?: string[]; mode: SearchMode }): VolumeSearchPlan {
  const { rawQuery, chips, mode } = input
  const text = lowerText(rawQuery, chips)
  const recommended = toSourceNames(input.recommendedSourceIds)
  const manualSafeLanes = buildManualSafeLanes(rawQuery, chips)
  const variants = buildQueryVariants(rawQuery, chips)

  let sources: SourceName[] = mode === 'precision'
    ? unique<SourceName>([...recommended, ...CORE_FAST]).slice(0, 5)
    : mode === 'balanced'
      ? unique<SourceName>([...recommended, ...CORE_FAST, ...BALANCED_EXTRA]).slice(0, 8)
      : mode === 'broad'
        ? unique<SourceName>([...recommended, ...TECHNICAL, ...(hasAny(text, AI_TERMS) ? AI_ML : []), ...(hasAny(text, HEALTH_TERMS) ? HEALTHCARE : [])]).slice(0, 12)
        : [...MARKET_MAP]

  if (hasAny(text, AI_TERMS)) sources = unique<SourceName>([...sources, ...AI_ML])
  if (hasAny(text, HEALTH_TERMS)) sources = unique<SourceName>([...sources, ...HEALTHCARE])
  if (hasAny(text, GOVCON_TERMS)) sources = unique<SourceName>([...GOVCON_BASE, ...sources])

  const maxSources = mode === 'market_map' ? 16 : mode === 'broad' ? 12 : mode === 'balanced' ? 8 : 5
  sources = sources.slice(0, maxSources)

  return {
    mode,
    modeLabel: MODE_LABELS[mode],
    sourceLimit: MODE_LIMITS[mode],
    liveSources: sources,
    manualSafeLanes,
    queryVariants: variants,
    lowResultActions: [
      'Try Broad or Market Map mode to expand source coverage.',
      'Remove location pressure and search skills only.',
      'Add adjacent titles or donor companies.',
      'Open public resume, portfolio, conference, or GitHub X-Ray lanes for manual review.',
      'Use package and research ecosystems when profile search is thin.',
      'If clearance terms are involved, treat them as manual-safe breadcrumbs and verify through authorized channels.',
    ],
  }
}

export const SEARCH_MODE_COPY: Record<SearchMode, { title: string; description: string }> = {
  precision: { title: 'Precision', description: 'Cleaner first pass: exact role plus strongest skills, fewer sources, lower noise.' },
  balanced: { title: 'Balanced', description: 'Default sourcer workflow: role, skills, adjacent source lanes, and moderate breadth.' },
  broad: { title: 'Broad', description: 'More recall: skills-first variants, adjacent ecosystems, and broader public-source coverage.' },
  market_map: { title: 'Market Map', description: 'Widest public-source discovery. Not full market coverage, but useful source coverage and manual-safe lanes.' },
}

export const UNVERIFIED_ITEMS = [
  'Identity',
  'Current employment',
  'Location',
  'Clearance/license status',
  'Contact accuracy',
  'Availability and interest',
]
