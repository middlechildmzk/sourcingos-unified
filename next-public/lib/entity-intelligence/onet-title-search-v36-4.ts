export type OnetOccupationRowV36_4 = {
  onetsoc_code?: string
  title?: string
  description?: string
}

export type OnetJobTitleRowV36_4 = {
  onetsoc_code?: string
  title?: string
  alternate_title?: string
  job_title?: string
  reported_job_title?: string
  short_title?: string
}

export type AuthoritativeTitleSuggestionV36_4 = {
  value: string
  canonicalTitle: string
  onetSocCode: string
  matchedText: string
  score: number
  source: 'onet'
  sourceVersion: '31.0'
  activation: 'suggested_inactive'
  searchOnly: true
  evidenceEligible: false
}

const BLOCKED_QUERY_TOKENS = new Set([
  'ts', 'sci', 'tssci', 'secret', 'clearance', 'cleared', 'poly', 'polygraph',
  'citizen', 'citizenship', 'public trust', 'top secret',
])

function clean(value: unknown, max = 160): string {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, max) : ''
}

function normalized(value: string): string {
  return clean(value, 200)
    .toLowerCase()
    .replace(/\b(?:senior|sr|junior|jr|principal|staff|lead)\.?\b/g, ' ')
    .replace(/[^a-z0-9+#./ -]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function tokens(value: string): string[] {
  return normalized(value).split(' ').filter(token => token.length > 1 && !['and', 'the', 'of', 'for'].includes(token))
}

/**
 * Returns a narrowly scoped title/typeahead query. Clearance, citizenship, and
 * other verification-only terms are never sent to O*NET as title vocabulary.
 */
export function sanitizeAuthoritativeTitleQueryV36_4(raw: string): string {
  const query = normalized(raw)
  if (query.length < 3 || query.length > 80) return ''
  if (BLOCKED_QUERY_TOKENS.has(query)) return ''
  if (/\b(?:ts\/sci|top secret|secret clearance|public trust|polygraph|citizenship)\b/i.test(query)) return ''
  return query
}

function similarity(query: string, candidate: string): number {
  const q = normalized(query)
  const c = normalized(candidate)
  if (!q || !c) return 0
  if (q === c) return 1
  if (c.startsWith(q)) return 0.96
  if (c.includes(q)) return 0.88

  const qTokens = tokens(q)
  const cTokens = tokens(c)
  if (!qTokens.length || !cTokens.length) return 0

  let exact = 0
  let prefix = 0
  for (const qToken of qTokens) {
    if (cTokens.includes(qToken)) exact++
    else if (cTokens.some(token => token.startsWith(qToken) || qToken.startsWith(token))) prefix++
  }
  const coverage = (exact + prefix * 0.72) / qTokens.length
  const precision = Math.min(1, (exact + prefix * 0.55) / cTokens.length)
  return coverage * 0.78 + precision * 0.22
}

function aliasFromRow(row: OnetJobTitleRowV36_4): string {
  return clean(row.alternate_title || row.job_title || row.reported_job_title || row.short_title || row.title)
}

/**
 * Pure ranking function over O*NET fixtures/datasets. Suggestions are always
 * search-only and never become candidate evidence or recruiter requirements.
 */
export function rankOnetTitleSuggestionsV36_4(input: {
  query: string
  occupations: OnetOccupationRowV36_4[]
  jobTitles: OnetJobTitleRowV36_4[]
  limit?: number
}): AuthoritativeTitleSuggestionV36_4[] {
  const query = sanitizeAuthoritativeTitleQueryV36_4(input.query)
  if (!query) return []
  const limit = Math.max(1, Math.min(input.limit ?? 12, 20))

  const canonicalByCode = new Map<string, string>()
  for (const row of input.occupations) {
    const code = clean(row.onetsoc_code, 20)
    const title = clean(row.title)
    if (code && title) canonicalByCode.set(code, title)
  }

  const candidates: AuthoritativeTitleSuggestionV36_4[] = []
  const consider = (codeValue: unknown, canonicalValue: unknown, matchValue: unknown, boost = 0) => {
    const code = clean(codeValue, 20)
    const matchedText = clean(matchValue)
    const canonicalTitle = canonicalByCode.get(code) || clean(canonicalValue)
    if (!code || !matchedText || !canonicalTitle) return
    const score = Math.min(1, similarity(query, matchedText) + boost)
    if (score < 0.58) return
    candidates.push({
      value: matchedText,
      canonicalTitle,
      onetSocCode: code,
      matchedText,
      score,
      source: 'onet',
      sourceVersion: '31.0',
      activation: 'suggested_inactive',
      searchOnly: true,
      evidenceEligible: false,
    })
  }

  for (const row of input.occupations) consider(row.onetsoc_code, row.title, row.title, 0.03)
  for (const row of input.jobTitles) consider(row.onetsoc_code, row.title, aliasFromRow(row), 0)

  const bestByValue = new Map<string, AuthoritativeTitleSuggestionV36_4>()
  for (const candidate of candidates) {
    const key = `${candidate.onetSocCode}:${candidate.value.toLowerCase()}`
    const previous = bestByValue.get(key)
    if (!previous || candidate.score > previous.score) bestByValue.set(key, candidate)
  }

  return [...bestByValue.values()]
    .sort((a, b) => b.score - a.score || a.value.localeCompare(b.value))
    .slice(0, limit)
}
