// ─────────────────────────────────────────────────────────────────────────────
// lib/search-query-builder.ts — Source-specific query building from composer chips.
//
// CORE PRINCIPLE: Public technical sources (GitHub, npm, PyPI, OpenAlex) do not
// contain clearance, seniority, or precise location data. Sending those terms
// returns zero results. Only skill/tool terms are used for live source queries.
//
// Chip classification:
//   hardTerms   — skill, tool → used in live source queries
//   softFilters — title, seniority, location, company, industry → UI display/review only
//   manualSafe  — clearance, employment-signal → route to manual sources only, never live API
//   certTerms   — certification → healthcare/academic sources only
// ─────────────────────────────────────────────────────────────────────────────

export type ChipType =
  | 'title' | 'skill' | 'tool' | 'certification' | 'location'
  | 'clearance' | 'company' | 'industry' | 'seniority' | 'employment-signal' | 'source'

export interface ComposerChip { canonical: string; type: ChipType }

export interface ChipClassification {
  /** Sent to live technical source queries. */
  hardTerms: ComposerChip[]
  /** Displayed as review filters — NOT sent to live sources. */
  softFilters: ComposerChip[]
  /** Never in live queries — route to manual-safe sources only. */
  manualSafe: ComposerChip[]
  /** Healthcare/academic sources only. */
  certTerms: ComposerChip[]
  /** Context hints for source lane scoring. */
  industryHints: ComposerChip[]
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
  rawFallback: string
  /** Broadened fallback — skill-terms only, no location/seniority */
  broadFallback: string
}

export interface QueryContext {
  /** Classification of the chips for UI display */
  classified: ChipClassification
  /** True when clearance chips are present — route to manual sources */
  hasClearance: boolean
  /** True when no skill/tool chips were found */
  isSkillLight: boolean
  /** Implied skills inferred from title chip when no skill chips exist */
  impliedSkills: string[]
}

// ── Title → implied skills mapping ────────────────────────────────────────────
// When no skill/tool chips are recognized, infer reasonable search terms from title.
const TITLE_SKILL_MAP: Record<string, string[]> = {
  'front end developer':    ['JavaScript', 'React', 'TypeScript', 'frontend', 'HTML'],
  'frontend engineer':      ['JavaScript', 'React', 'TypeScript', 'frontend'],
  'software engineer':      ['JavaScript', 'Python', 'TypeScript', 'Git'],
  'full stack developer':   ['JavaScript', 'React', 'Node.js', 'Python'],
  'full stack engineer':    ['JavaScript', 'React', 'Node.js', 'TypeScript'],
  'backend engineer':       ['Python', 'Node.js', 'PostgreSQL', 'REST API'],
  'devsecops engineer':     ['Kubernetes', 'Terraform', 'Docker', 'CI/CD', 'pipeline'],
  'devops engineer':        ['Kubernetes', 'Docker', 'Terraform', 'AWS', 'CI/CD'],
  'platform engineer':      ['Kubernetes', 'Terraform', 'AWS', 'Docker', 'Helm'],
  'kubernetes engineer':    ['Kubernetes', 'Docker', 'Helm', 'Terraform'],
  'ml engineer':            ['PyTorch', 'TensorFlow', 'Python', 'scikit-learn', 'MLOps'],
  'data scientist':         ['Python', 'pandas', 'scikit-learn', 'SQL', 'Jupyter'],
  'data engineer':          ['Python', 'SQL', 'Spark', 'Kafka', 'PostgreSQL'],
  'cybersecurity engineer': ['SIEM', 'Python', 'network security', 'vulnerability'],
  'security analyst':       ['SIEM', 'Splunk', 'threat hunting', 'incident response'],
  'nurse recruiter':        ['Epic', 'healthcare', 'clinical', 'nursing'],
  'technical sourcer':      ['GitHub', 'Boolean', 'sourcing', 'recruiting'],
  'technical recruiter':    ['GitHub', 'Boolean', 'sourcing', 'recruiting'],
  'staff engineer':         ['distributed systems', 'architecture', 'TypeScript', 'Python'],
  'site reliability engineer': ['Kubernetes', 'Docker', 'Python', 'monitoring', 'SRE'],
  'recruiter':              ['recruiting', 'ATS', 'sourcing', 'talent acquisition'],
}

function titleToImpliedSkills(titleCanonical: string): string[] {
  const lower = titleCanonical.toLowerCase()
  for (const [key, skills] of Object.entries(TITLE_SKILL_MAP)) {
    if (lower.includes(key) || key.includes(lower)) return skills
  }
  return []
}

// ── Stop words for raw query cleaning ─────────────────────────────────────────
// These terms produce zero results on technical public sources.
const STOP_WORDS_FOR_LIVE_SEARCH = new Set([
  'ts', 'sci', 'ts/sci', 'tssci', 'secret', 'top', 'clearance', 'cleared',
  'polygraph', 'poly', 'public', 'trust',
  'senior', 'sr', 'junior', 'jr', 'lead', 'staff', 'principal', 'distinguished',
  'dc', 'washington', 'virginia', 'maryland', 'northern', 'nova',
  'remote', 'hybrid', 'onsite', 'metro',
  'candidate', 'recruiter', 'hiring', 'job', 'position', 'opening',
  'developer', 'engineer', 'manager',  // too generic alone
])

function cleanRawQuery(rawQuery: string, removeChips: ComposerChip[]): string {
  const removeTerms = new Set(removeChips.map(c => c.canonical.toLowerCase()))
  return rawQuery.split(/\s+/)
    .filter(w => {
      const lower = w.toLowerCase()
      return !STOP_WORDS_FOR_LIVE_SEARCH.has(lower) && !removeTerms.has(lower)
    })
    .slice(0, 5)
    .join(' ')
    .trim()
}

// ── Chip classification ────────────────────────────────────────────────────────
export function classifyChips(chips: ComposerChip[]): ChipClassification {
  return {
    hardTerms:    chips.filter(c => c.type === 'skill' || c.type === 'tool'),
    softFilters:  chips.filter(c => ['title', 'seniority', 'location', 'company'].includes(c.type)),
    manualSafe:   chips.filter(c => c.type === 'clearance' || c.type === 'employment-signal'),
    certTerms:    chips.filter(c => c.type === 'certification'),
    industryHints: chips.filter(c => c.type === 'industry'),
  }
}

// ── Core query term extraction ─────────────────────────────────────────────────
// Returns the best live-search terms for a chip set.
// Priority: hardTerms > implied from title > cleaned raw query
function getLiveTerms(classified: ChipClassification, rawQuery: string): string[] {
  if (classified.hardTerms.length > 0) {
    return classified.hardTerms.map(c => c.canonical).slice(0, 5)
  }
  // Infer from title
  const titleChip = classified.softFilters.find(c => c.type === 'title')
  if (titleChip) {
    const implied = titleToImpliedSkills(titleChip.canonical)
    if (implied.length > 0) return implied.slice(0, 4)
  }
  // Fall back to cleaned raw query
  const cleaned = cleanRawQuery(rawQuery, [
    ...classified.manualSafe,
    ...classified.softFilters.filter(c => c.type === 'location' || c.type === 'seniority'),
  ])
  return cleaned ? [cleaned] : []
}

// ── GitHub ────────────────────────────────────────────────────────────────────
// ONLY skill/tool/implied terms. Clearance and seniority produce zero results.
// Optional simple location filter (city only, not "Metro" or multi-word areas).
function buildGithubQuery(classified: ChipClassification, rawQuery: string): string {
  const terms = getLiveTerms(classified, rawQuery)
  if (terms.length === 0) return rawQuery.split(' ').slice(0, 3).join(' ')

  // Add location only if it's a simple short location (not "Northern Virginia", "DC Metro")
  const loc = classified.softFilters.find(c => c.type === 'location')
  const simpleLocation = loc &&
    loc.canonical.split(' ').length <= 2 &&
    !loc.canonical.toLowerCase().includes('metro') &&
    !loc.canonical.toLowerCase().includes('northern') &&
    loc.canonical.toLowerCase() !== 'remote'

  if (simpleLocation) {
    return `${terms.join(' ')} location:"${loc!.canonical}"`
  }
  return terms.join(' ')
}

// ── npm / PyPI / crates / RubyGems ────────────────────────────────────────────
// Package ecosystem: only package/tool/language terms.
// Clearance, location, seniority, and title language produce zero results.
function buildPackageQuery(classified: ChipClassification, rawQuery: string): string {
  // Only JS/Python/Rust/Ruby relevant tools
  const pkgTerms = classified.hardTerms
    .filter(c => !['kubernetes', 'terraform', 'aws', 'azure', 'gcp', 'docker', 'splunk', 'siem'].includes(c.canonical.toLowerCase()))
    .map(c => c.canonical.toLowerCase())

  if (pkgTerms.length > 0) return pkgTerms.slice(0, 3).join(' ')

  // Fall back to all hard terms
  const all = classified.hardTerms.map(c => c.canonical.toLowerCase())
  if (all.length > 0) return all.slice(0, 3).join(' ')

  // Clean raw query removing all stop words
  return cleanRawQuery(rawQuery, [
    ...classified.manualSafe,
    ...classified.softFilters,
  ]).split(' ').slice(0, 3).join(' ')
}

// ── OpenAlex ──────────────────────────────────────────────────────────────────
// Research database: concepts, AI/ML, healthcare, engineering topics.
// No clearance, seniority, or job-title language.
function buildOpenAlexQuery(classified: ChipClassification, rawQuery: string): string {
  const researchTerms = classified.hardTerms
    .concat(classified.industryHints)
    .filter(c =>
      !['kubernetes', 'docker', 'terraform'].includes(c.canonical.toLowerCase())
    )
    .map(c => c.canonical)

  if (researchTerms.length > 0) return researchTerms.slice(0, 3).join(' ')

  // Try implied skills from title
  const titleChip = classified.softFilters.find(c => c.type === 'title')
  if (titleChip) {
    const implied = titleToImpliedSkills(titleChip.canonical).slice(0, 2)
    if (implied.length > 0) return implied.join(' ')
  }

  return cleanRawQuery(rawQuery, classified.manualSafe.concat(classified.softFilters))
}

// ── Hugging Face ──────────────────────────────────────────────────────────────
// Only AI/ML terms. No infra or recruiting language.
function buildHuggingFaceQuery(classified: ChipClassification, rawQuery: string): string {
  const aiTerms = classified.hardTerms
    .filter(c => [
      'pytorch', 'tensorflow', 'transformers', 'llm', 'nlp', 'hugging face',
      'fine-tuning', 'mlops', 'diffusers', 'peft', 'lora', 'bert', 'gpt',
      'computer vision', 'deep learning',
    ].some(kw => c.canonical.toLowerCase().includes(kw)))
    .map(c => c.canonical)

  if (aiTerms.length > 0) return aiTerms.slice(0, 3).join(' ')
  if (classified.hardTerms.length > 0) return classified.hardTerms[0].canonical
  return 'machine learning'
}

// ── Healthcare sources (NPI, PubMed, ORCID) ───────────────────────────────────
function buildHealthcareQuery(classified: ChipClassification, rawQuery: string): string {
  const healthTerms = [
    ...classified.certTerms,
    ...classified.hardTerms.filter(c =>
      ['epic', 'cerner', 'emr', 'ehr', 'hl7', 'fhir'].includes(c.canonical.toLowerCase())
    ),
  ].map(c => c.canonical)

  if (healthTerms.length > 0) return healthTerms.slice(0, 2).join(' ')
  const titleChip = classified.softFilters.find(c => c.type === 'title')
  if (titleChip) return titleChip.canonical
  return rawQuery.split(' ').slice(0, 2).join(' ')
}

// ── Broad fallback query ──────────────────────────────────────────────────────
// Used when the initial search returns zero results.
// Strips location, seniority, and clearance — skill terms only.
export function buildBroadQuery(chips: ComposerChip[], rawQuery: string): string {
  const classified = classifyChips(chips)
  const terms = getLiveTerms(classified, rawQuery)
  // Take only the top 2-3 terms for maximum breadth
  if (terms.length > 0) return terms.slice(0, 3).join(' ')
  return rawQuery.split(' ').filter(w => w.length > 3).slice(0, 3).join(' ')
}

// ── Source lane recommendations ────────────────────────────────────────────────
export function recommendSourcesFromChips(chips: ComposerChip[]): string[] {
  const classified = classifyChips(chips)
  const scores: Record<string, number> = {}
  const add = (id: string, w = 1) => { scores[id] = (scores[id] || 0) + w }

  const isHealthcare = classified.industryHints.some(c => c.canonical.toLowerCase() === 'healthcare') ||
    classified.hardTerms.some(c => ['epic', 'cerner', 'npi'].includes(c.canonical.toLowerCase()))
  const isAI = classified.industryHints.some(c => c.canonical.toLowerCase() === 'ai/ml') ||
    classified.hardTerms.some(c => ['pytorch', 'tensorflow', 'llm', 'nlp', 'hugging face'].includes(c.canonical.toLowerCase()))
  const hasPython = classified.hardTerms.some(c => c.canonical.toLowerCase() === 'python')
  const hasJS = classified.hardTerms.some(c => ['react', 'typescript', 'node.js', 'javascript'].includes(c.canonical.toLowerCase()))
  const hasRust = classified.hardTerms.some(c => c.canonical.toLowerCase() === 'rust')
  const hasClearance = classified.manualSafe.some(c => c.type === 'clearance')

  add('github', 3)
  if (isHealthcare) { add('npi', 4); add('pubmed', 2) }
  if (isAI) { add('huggingface', 4); add('openalex', 3); add('pypi', 2) }
  if (hasPython) { add('pypi', 3) }
  if (hasJS) { add('npm', 3); add('github', 1) }
  if (hasRust) { add('crates', 3) }
  if (hasClearance) { /* clearance → manual-safe only, no live sources */ }
  classified.hardTerms.forEach(() => { add('github', 1); add('stackoverflow', 1) })

  if (Object.keys(scores).length === 0) add('github', 3)

  return Object.entries(scores)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([id]) => id)
}

// ── Main export ────────────────────────────────────────────────────────────────
export function buildSourceQueries(chips: ComposerChip[], rawQuery: string): SourceQueries {
  const classified = classifyChips(chips)
  return {
    github:       buildGithubQuery(classified, rawQuery),
    openalex:     buildOpenAlexQuery(classified, rawQuery),
    npm:          buildPackageQuery(classified, rawQuery),
    pypi:         buildPackageQuery(classified, rawQuery),
    huggingface:  buildHuggingFaceQuery(classified, rawQuery),
    npi:          buildHealthcareQuery(classified, rawQuery),
    pubmed:       buildHealthcareQuery(classified, rawQuery),
    orcid:        buildOpenAlexQuery(classified, rawQuery),
    stackOverflow: buildGithubQuery(classified, rawQuery),
    rawFallback:  rawQuery,
    broadFallback: buildBroadQuery(chips, rawQuery),
  }
}

/** Build QueryContext for the UI — classification + metadata for display. */
export function buildQueryContext(chips: ComposerChip[], rawQuery: string): QueryContext {
  const classified = classifyChips(chips)
  const titleChip = classified.softFilters.find(c => c.type === 'title')
  const impliedSkills = titleChip ? titleToImpliedSkills(titleChip.canonical) : []
  return {
    classified,
    hasClearance: classified.manualSafe.some(c => c.type === 'clearance'),
    isSkillLight: classified.hardTerms.length === 0,
    impliedSkills,
  }
}
