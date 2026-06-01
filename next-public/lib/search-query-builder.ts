// ─────────────────────────────────────────────────────────────────────────────
// lib/search-query-builder.ts — Source-specific query building from composer chips.
// Takes the SearchComposer output (entity chips + raw query) and builds
// optimized queries for each source connector type. No single raw query
// should be passed to all sources identically.
// ─────────────────────────────────────────────────────────────────────────────

export type ChipType = 'title' | 'skill' | 'tool' | 'certification' | 'location' |
  'clearance' | 'company' | 'industry' | 'seniority' | 'employment-signal' | 'source'

export interface ComposerChip {
  canonical: string
  type: ChipType
}

export interface SourceQueries {
  github: string
  openalex: string
  npm: string
  pypi: string
  huggingface: string
  npi: string
  pubmed: string
  orcid: string
  stackOverflow: string
  rawFallback: string // for sources without specific building
}

// Return terms relevant for a given chip type and source class
function titlesAndSkills(chips: ComposerChip[]): string[] {
  return chips
    .filter(c => c.type === 'title' || c.type === 'skill' || c.type === 'tool' || c.type === 'certification')
    .map(c => c.canonical)
}

function locationTerms(chips: ComposerChip[]): string {
  const locs = chips.filter(c => c.type === 'location').map(c => c.canonical)
  return locs.join(' ')
}

function industryTerms(chips: ComposerChip[]): string[] {
  return chips.filter(c => c.type === 'industry').map(c => c.canonical)
}

// ── GitHub ────────────────────────────────────────────────────────────────────
// GitHub search query focuses on technical skills and tools; clears recruiter noise.
// Adds language/topic hints where inferrable from chips.
function buildGithubQuery(chips: ComposerChip[], rawQuery: string): string {
  const skills = chips
    .filter(c => c.type === 'skill' || c.type === 'tool')
    .map(c => c.canonical.toLowerCase())

  const title = chips.find(c => c.type === 'title')?.canonical

  // Build from specific chips when available; fall back to rawQuery
  const terms: string[] = []
  if (skills.length > 0) terms.push(...skills.slice(0, 4))
  else if (title) terms.push(title)
  else terms.push(rawQuery)

  // Add location if it's a real location (not "remote")
  const loc = chips.find(c => c.type === 'location')?.canonical
  if (loc && loc.toLowerCase() !== 'remote' && loc.toLowerCase() !== 'hybrid') {
    return `${terms.join(' ')} location:"${loc}"`
  }

  return terms.join(' ')
}

// ── OpenAlex ──────────────────────────────────────────────────────────────────
// OpenAlex is a research/publication database. Best for AI/ML, healthcare,
// engineering, and research-adjacent roles. Uses concept-level terms.
function buildOpenAlexQuery(chips: ComposerChip[], rawQuery: string): string {
  const researchTerms = chips
    .filter(c =>
      c.type === 'skill' ||
      (c.type === 'industry' && ['ai/ml', 'healthcare', 'biotech'].includes(c.canonical.toLowerCase()))
    )
    .map(c => c.canonical)

  const institution = chips.find(c => c.type === 'company')?.canonical

  if (researchTerms.length > 0) {
    const base = researchTerms.slice(0, 3).join(' ')
    return institution ? `${base} ${institution}` : base
  }

  return rawQuery
}

// ── npm ───────────────────────────────────────────────────────────────────────
// npm is best for JavaScript/TypeScript/Node.js engineers.
// Search by package keywords, not job titles.
function buildNpmQuery(chips: ComposerChip[], rawQuery: string): string {
  const jsTerms = chips
    .filter(c =>
      c.type === 'skill' || c.type === 'tool'
    )
    .filter(c => !['kubernetes', 'docker', 'terraform', 'aws', 'azure', 'gcp'].includes(c.canonical.toLowerCase()))
    .map(c => c.canonical.toLowerCase())

  if (jsTerms.length > 0) return jsTerms.slice(0, 3).join(' ')

  // Strip title/location words that won't match npm packages
  const clean = rawQuery
    .replace(/\b(engineer|developer|recruiter|sourcer|remote|hybrid|senior|staff|lead)\b/gi, '')
    .trim()
  return clean || rawQuery
}

// ── PyPI ──────────────────────────────────────────────────────────────────────
// PyPI is best for Python/ML/data engineers. Use Python-specific terms.
function buildPypiQuery(chips: ComposerChip[], rawQuery: string): string {
  const pyTerms = chips
    .filter(c => c.type === 'skill' || c.type === 'tool')
    .filter(c => ['pytorch', 'tensorflow', 'numpy', 'pandas', 'fastapi', 'django', 'flask', 'python', 'ml', 'nlp', 'llm'].some(kw => c.canonical.toLowerCase().includes(kw)))
    .map(c => c.canonical.toLowerCase())

  if (pyTerms.length > 0) return pyTerms.slice(0, 3).join(' ')

  const clean = rawQuery
    .replace(/\b(engineer|developer|recruiter|remote|hybrid|senior|staff|lead)\b/gi, '')
    .trim()
  return clean || rawQuery
}

// ── Hugging Face ──────────────────────────────────────────────────────────────
// Hugging Face is best for AI/ML researchers. Use model and framework terms.
function buildHuggingFaceQuery(chips: ComposerChip[], rawQuery: string): string {
  const aiTerms = chips
    .filter(c =>
      c.type === 'skill' || c.type === 'tool' ||
      (c.type === 'industry' && c.canonical.toLowerCase().includes('ai'))
    )
    .map(c => c.canonical.toLowerCase())

  if (aiTerms.length > 0) return aiTerms.slice(0, 3).join(' ')
  return rawQuery
}

// ── NPI (healthcare providers) ────────────────────────────────────────────────
// NPI is most useful for searching licensed healthcare providers.
// Use specialty terms and credentials.
function buildNpiQuery(chips: ComposerChip[], rawQuery: string): string {
  const healthTerms = chips
    .filter(c =>
      c.type === 'title' ||
      c.type === 'certification' ||
      (c.type === 'industry' && c.canonical.toLowerCase() === 'healthcare')
    )
    .map(c => c.canonical)

  return healthTerms.slice(0, 2).join(' ') || rawQuery
}

// ── PubMed / ORCID ────────────────────────────────────────────────────────────
// Research databases. Use research-oriented terms.
function buildPubmedQuery(chips: ComposerChip[], rawQuery: string): string {
  const clinicalTerms = chips
    .filter(c => c.type === 'tool' || (c.type === 'industry' && ['healthcare', 'biotech'].includes(c.canonical.toLowerCase())))
    .map(c => c.canonical)

  return clinicalTerms.slice(0, 3).join(' ') || rawQuery
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Build source-specific queries from composer chips and raw query.
 * Each source gets a query optimized for its content type.
 */
export function buildSourceQueries(
  chips: ComposerChip[],
  rawQuery: string
): SourceQueries {
  return {
    github: buildGithubQuery(chips, rawQuery),
    openalex: buildOpenAlexQuery(chips, rawQuery),
    npm: buildNpmQuery(chips, rawQuery),
    pypi: buildPypiQuery(chips, rawQuery),
    huggingface: buildHuggingFaceQuery(chips, rawQuery),
    npi: buildNpiQuery(chips, rawQuery),
    pubmed: buildPubmedQuery(chips, rawQuery),
    orcid: buildPubmedQuery(chips, rawQuery), // same as pubmed
    stackOverflow: buildGithubQuery(chips, rawQuery), // reuse github query
    rawFallback: rawQuery,
  }
}

/**
 * Which sources make sense for a given set of chips?
 * Returns ordered list of source IDs based on entity types detected.
 */
export function recommendSourcesFromChips(chips: ComposerChip[]): string[] {
  const scores: Record<string, number> = {}
  const add = (id: string, w = 1) => { scores[id] = (scores[id] || 0) + w }

  const hasHealthcare = chips.some(c => c.canonical.toLowerCase() === 'healthcare' || c.type === 'certification')
  const hasAI = chips.some(c => ['ai/ml', 'pytorch', 'tensorflow', 'hugging face', 'llm', 'nlp'].includes(c.canonical.toLowerCase()))
  const hasGovCon = chips.some(c => c.type === 'clearance' || (c.type === 'industry' && c.canonical === 'GovCon'))
  const hasResearch = chips.some(c => c.type === 'industry' && ['ai/ml', 'biotech', 'healthcare'].includes(c.canonical.toLowerCase()))
  const hasPython = chips.some(c => ['python', 'pytorch', 'tensorflow', 'ml'].includes(c.canonical.toLowerCase()))
  const hasJS = chips.some(c => ['react', 'node', 'typescript', 'javascript'].includes(c.canonical.toLowerCase()))

  // Always recommend GitHub for technical roles
  add('github', 3)

  if (hasHealthcare) { add('npi', 4); add('pubmed', 2) }
  if (hasAI) { add('huggingface', 4); add('openalex', 3); add('pypi', 2) }
  if (hasResearch) { add('openalex', 3); add('orcid', 2) }
  if (hasPython) { add('pypi', 3) }
  if (hasJS) { add('npm', 3) }
  if (hasGovCon) { add('github', 1) } // cleared engineers still show on GitHub

  chips.filter(c => c.type === 'skill' || c.type === 'tool').forEach(() => {
    add('github', 1); add('stackoverflow', 1)
  })

  return Object.entries(scores)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([id]) => id)
}
