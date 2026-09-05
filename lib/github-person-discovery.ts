import 'server-only'

import type {
  ContactSignal,
  EvidenceItem,
  IdentitySignal,
  SourceResult,
  SourceSearchRequest,
} from './source-types'

export type GitHubDiscoveryHealth = 'healthy' | 'degraded' | 'rate_limited' | 'error'

export type GitHubDiscoveryDiagnostics = {
  source: 'github'
  strategy: 'repository_contributors' | 'user_search_fallback'
  health: GitHubDiscoveryHealth
  effectiveQuery: string
  repositoriesExamined: number
  contributorsExamined: number
  profilesHydrated: number
  personResults: number
  skippedBots: number
  durationMs: number
  partial: boolean
  rateLimitRemaining?: number
  rateLimitResetAt?: string
}

export type GitHubDiscoveryResponse = {
  results: SourceResult[]
  warnings: string[]
  diagnostics: GitHubDiscoveryDiagnostics
}

type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>

type GitHubRepository = {
  full_name?: string
  html_url?: string
  description?: string | null
  language?: string | null
  topics?: string[]
  stargazers_count?: number
  contributors_url?: string
  archived?: boolean
  fork?: boolean
}

type GitHubContributor = {
  login?: string
  avatar_url?: string
  html_url?: string
  url?: string
  type?: string
  contributions?: number
}

type GitHubProfile = GitHubContributor & {
  name?: string | null
  bio?: string | null
  company?: string | null
  location?: string | null
  blog?: string | null
  email?: string | null
  public_repos?: number
}

type ContributorRepositorySignal = {
  fullName: string
  url: string
  description: string
  language: string
  topics: string[]
  stars: number
  contributions: number
}

type AggregatedContributor = {
  contributor: GitHubContributor
  repositories: ContributorRepositorySignal[]
  totalContributions: number
}

type GitHubJsonResponse<T> = {
  data: T
  rateLimitRemaining?: number
  rateLimitResetAt?: string
}

export type GitHubDiscoveryOptions = {
  fetchImpl?: FetchLike
  now?: () => Date
  token?: string
}

class GitHubRequestError extends Error {
  readonly status: number
  readonly rateLimitRemaining?: number
  readonly rateLimitResetAt?: string

  constructor(message: string, status: number, rateLimitRemaining?: number, rateLimitResetAt?: string) {
    super(message)
    this.name = 'GitHubRequestError'
    this.status = status
    this.rateLimitRemaining = rateLimitRemaining
    this.rateLimitResetAt = rateLimitResetAt
  }
}

function safe(value: unknown): string {
  return String(value || '').trim()
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.map(value => value.trim()).filter(Boolean)))
}

function parseRateLimit(headers: Headers): { remaining?: number; resetAt?: string } {
  const rawRemaining = headers.get('x-ratelimit-remaining')
  const rawReset = headers.get('x-ratelimit-reset')
  const remaining = rawRemaining !== null && Number.isFinite(Number(rawRemaining))
    ? Number(rawRemaining)
    : undefined
  const resetSeconds = rawReset !== null && Number.isFinite(Number(rawReset))
    ? Number(rawReset)
    : undefined
  return {
    remaining,
    resetAt: resetSeconds ? new Date(resetSeconds * 1000).toISOString() : undefined,
  }
}

function mergeRateLimit(
  current: { remaining?: number; resetAt?: string },
  incoming: { rateLimitRemaining?: number; rateLimitResetAt?: string },
): { remaining?: number; resetAt?: string } {
  const candidates = [current.remaining, incoming.rateLimitRemaining]
    .filter((value): value is number => typeof value === 'number')
  return {
    remaining: candidates.length ? Math.min(...candidates) : undefined,
    resetAt: incoming.rateLimitResetAt || current.resetAt,
  }
}

async function githubJson<T>(
  url: string,
  fetchImpl: FetchLike,
  token?: string,
): Promise<GitHubJsonResponse<T>> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 5000)
  try {
    const headers: Record<string, string> = {
      accept: 'application/vnd.github+json',
      'user-agent': 'SourcingOS-public-source-discovery',
      'x-github-api-version': '2022-11-28',
    }
    if (token) headers.authorization = `Bearer ${token}`

    const response = await fetchImpl(url, { headers, signal: controller.signal })
    const rate = parseRateLimit(response.headers)
    if (!response.ok) {
      let detail = ''
      try {
        const body = await response.json() as { message?: string }
        detail = safe(body?.message)
      } catch {
        detail = ''
      }
      throw new GitHubRequestError(
        `GitHub returned ${response.status}${detail ? `: ${detail}` : ''}`,
        response.status,
        rate.remaining,
        rate.resetAt,
      )
    }

    return {
      data: await response.json() as T,
      rateLimitRemaining: rate.remaining,
      rateLimitResetAt: rate.resetAt,
    }
  } finally {
    clearTimeout(timeout)
  }
}

export function isLikelyBotAccount(login: string): boolean {
  const normalized = login.toLowerCase().trim()
  return normalized.endsWith('[bot]')
    || normalized.endsWith('-bot')
    || normalized.endsWith('_bot')
    || normalized === 'github-actions'
    || normalized === 'dependabot'
    || normalized === 'renovate'
}

export function githubDiscoveryTerms(query: string): string[] {
  const withoutLocation = query
    .replace(/location:\s*"[^"]+"/gi, ' ')
    .replace(/location:\S+/gi, ' ')
  const terms = withoutLocation
    .replace(/[^a-zA-Z0-9+#./-]+/g, ' ')
    .split(/\s+/)
    .map(term => term.trim())
    .filter(term => term.length > 1)
    .slice(0, 5)
  return unique(terms)
}

export function buildGitHubRepositoryQuery(query: string): string {
  const terms = githubDiscoveryTerms(query)
  const core = terms.length ? terms.join(' ') : 'software'
  return `${core} in:name,description,readme fork:false archived:false`
}

function evidence(
  id: string,
  label: string,
  detail: string,
  confidence: EvidenceItem['confidence'],
  url?: string,
  observedAt = new Date().toISOString(),
): EvidenceItem {
  return { id, label, detail, source: 'github', confidence, url, observedAt }
}

function commonIdentitySignals(
  name: string,
  location: string,
  organization: string,
  skills: string[],
  website: string,
): IdentitySignal[] {
  return [
    { type: 'name', value: name, weight: 15, source: 'github' },
    ...(location ? [{ type: 'location' as const, value: location, weight: 12, source: 'github' as const }] : []),
    ...(organization ? [{ type: 'organization' as const, value: organization, weight: 10, source: 'github' as const }] : []),
    ...(website ? [{ type: 'website' as const, value: website, weight: 25, source: 'github' as const }] : []),
    ...skills.slice(0, 6).map(skill => ({ type: 'skill' as const, value: skill, weight: 3, source: 'github' as const })),
  ]
}

export function buildGitHubContributorResult(
  aggregate: AggregatedContributor,
  profile: GitHubProfile | null,
  query: string,
  observedAt = new Date().toISOString(),
): SourceResult {
  const login = safe(profile?.login) || safe(aggregate.contributor.login)
  const name = safe(profile?.name) || login
  const profileUrl = safe(profile?.html_url) || safe(aggregate.contributor.html_url) || `https://github.com/${login}`
  const location = safe(profile?.location)
  const organization = safe(profile?.company)
  const website = safe(profile?.blog)
  const repositorySkills = aggregate.repositories.flatMap(repository => [
    repository.language,
    ...repository.topics,
  ])
  const skills = unique([...githubDiscoveryTerms(query), ...repositorySkills]).slice(0, 12)
  const repositories = aggregate.repositories
    .slice()
    .sort((left, right) => right.contributions - left.contributions || right.stars - left.stars)
    .slice(0, 4)

  const resultEvidence: EvidenceItem[] = repositories.flatMap((repository, index) => [
    evidence(
      `github-${login}-contribution-${index}`,
      'Public repository contribution signal',
      `${name} appears in GitHub's public contributor list for ${repository.fullName} with ${repository.contributions} reported contributions.`,
      'high',
      repository.url,
      observedAt,
    ),
    evidence(
      `github-${login}-relevance-${index}`,
      'Query-relevant repository signal',
      `${repository.fullName} matched the GitHub repository search for ${query}.${repository.language ? ` Primary language: ${repository.language}.` : ''}${repository.stars ? ` ${repository.stars} public stars.` : ''}`,
      'medium',
      repository.url,
      observedAt,
    ),
  ])

  if (profile?.bio) {
    resultEvidence.push(evidence(
      `github-${login}-bio`,
      'Public profile context',
      safe(profile.bio),
      'low',
      profileUrl,
      observedAt,
    ))
  }

  const contactSignals: ContactSignal[] = [
    { type: 'profile_url', value: profileUrl, source: 'github', verified: false, note: 'Public GitHub profile URL.' },
    ...(profile?.email ? [{ type: 'public_email' as const, value: safe(profile.email), source: 'github' as const, verified: false as const, note: 'Public GitHub email. Treat as unverified until recruiter confirms permission and accuracy.' }] : []),
    ...(website ? [{ type: 'website' as const, value: website, source: 'github' as const, verified: false as const, note: 'Public website listed on the GitHub profile.' }] : []),
  ]

  return {
    id: `github:${login}`,
    source: 'github',
    entityKind: 'person',
    sourceProfileId: login,
    displayName: name,
    headline: safe(profile?.bio) || `GitHub contributor across ${repositories.length} query-relevant public ${repositories.length === 1 ? 'repository' : 'repositories'}.`,
    location,
    organization,
    profileUrl,
    avatarUrl: safe(profile?.avatar_url) || safe(aggregate.contributor.avatar_url),
    skills,
    evidence: resultEvidence,
    contactSignals,
    identitySignals: commonIdentitySignals(name, location, organization, skills, website),
    refreshedAt: observedAt,
    raw: {
      strategy: 'repository_contributors',
      profile: profile || aggregate.contributor,
      repositories,
      totalContributions: aggregate.totalContributions,
    },
  }
}

function buildFallbackUserResult(
  profile: GitHubProfile,
  query: string,
  observedAt: string,
): SourceResult | null {
  const login = safe(profile.login)
  if (!login || profile.type !== 'User' || isLikelyBotAccount(login)) return null
  const name = safe(profile.name) || login
  const profileUrl = safe(profile.html_url) || `https://github.com/${login}`
  const location = safe(profile.location)
  const organization = safe(profile.company)
  const website = safe(profile.blog)
  const skills = unique([...githubDiscoveryTerms(query), ...githubDiscoveryTerms(safe(profile.bio))]).slice(0, 10)
  return {
    id: `github:${login}`,
    source: 'github',
    entityKind: 'person',
    sourceProfileId: login,
    displayName: name,
    headline: safe(profile.bio) || `GitHub user matching ${query}`,
    location,
    organization,
    profileUrl,
    avatarUrl: safe(profile.avatar_url),
    skills,
    evidence: [
      evidence(
        `github-${login}-fallback`,
        'Public GitHub profile search match',
        `${name} matched GitHub user search for ${query}. This is a discovery signal, not verified role fit.`,
        'medium',
        profileUrl,
        observedAt,
      ),
      ...(profile.public_repos ? [evidence(
        `github-${login}-repositories`,
        'Public repository footprint',
        `${profile.public_repos} public repositories are visible on the profile.`,
        'medium',
        profileUrl,
        observedAt,
      )] : []),
    ],
    contactSignals: [
      { type: 'profile_url', value: profileUrl, source: 'github', verified: false, note: 'Public GitHub profile URL.' },
      ...(profile.email ? [{ type: 'public_email' as const, value: safe(profile.email), source: 'github' as const, verified: false as const, note: 'Public GitHub email. Treat as unverified until recruiter confirms permission and accuracy.' }] : []),
      ...(website ? [{ type: 'website' as const, value: website, source: 'github' as const, verified: false as const, note: 'Public website listed on the GitHub profile.' }] : []),
    ],
    identitySignals: commonIdentitySignals(name, location, organization, skills, website),
    refreshedAt: observedAt,
    raw: { strategy: 'user_search_fallback', profile },
  }
}

function diagnosticHealth(warnings: string[], hasResults: boolean): GitHubDiscoveryHealth {
  if (warnings.some(warning => warning.toLowerCase().includes('rate limit'))) return 'rate_limited'
  if (hasResults && warnings.length) return 'degraded'
  if (hasResults) return 'healthy'
  return warnings.length ? 'error' : 'healthy'
}

function warningFromError(error: unknown): string {
  if (error instanceof GitHubRequestError) {
    if (error.status === 403 || error.status === 429 || error.rateLimitRemaining === 0) {
      return `GitHub rate limit reached${error.rateLimitResetAt ? ` until ${error.rateLimitResetAt}` : ''}. No candidate claim was inferred from the failed request.`
    }
    return `${error.message}. No candidate claim was inferred from the failed request.`
  }
  if (error instanceof Error && error.name === 'AbortError') {
    return 'GitHub request timed out. Partial results, if any, remain explicitly partial.'
  }
  return 'GitHub discovery failed. No candidate claim was inferred from the failed request.'
}

export async function searchGitHubPeople(
  req: SourceSearchRequest,
  options: GitHubDiscoveryOptions = {},
): Promise<GitHubDiscoveryResponse> {
  const fetchImpl = options.fetchImpl || fetch
  const startedAt = Date.now()
  const observedAt = (options.now || (() => new Date()))().toISOString()
  const token = options.token || process.env.GITHUB_PERSON_DISCOVERY_TOKEN || process.env.GITHUB_TOKEN
  const warnings: string[] = []
  let rate: { remaining?: number; resetAt?: string } = {}
  let repositoriesExamined = 0
  let contributorsExamined = 0
  let profilesHydrated = 0
  let skippedBots = 0
  let partial = false
  let strategy: GitHubDiscoveryDiagnostics['strategy'] = 'repository_contributors'
  const requestedLimit = Math.min(Math.max(req.limit || 6, 1), 8)
  const repositoryQuery = buildGitHubRepositoryQuery(req.query)

  const finish = (results: SourceResult[], effectiveQuery: string): GitHubDiscoveryResponse => ({
    results,
    warnings: unique(warnings),
    diagnostics: {
      source: 'github',
      strategy,
      health: diagnosticHealth(warnings, results.length > 0),
      effectiveQuery,
      repositoriesExamined,
      contributorsExamined,
      profilesHydrated,
      personResults: results.length,
      skippedBots,
      durationMs: Math.max(0, Date.now() - startedAt),
      partial,
      rateLimitRemaining: rate.remaining,
      rateLimitResetAt: rate.resetAt,
    },
  })

  try {
    const repositorySearch = await githubJson<{ items?: GitHubRepository[] }>(
      `https://api.github.com/search/repositories?q=${encodeURIComponent(repositoryQuery)}&sort=stars&order=desc&per_page=3`,
      fetchImpl,
      token,
    )
    rate = mergeRateLimit(rate, repositorySearch)
    const repositories = Array.isArray(repositorySearch.data.items)
      ? repositorySearch.data.items.filter(repository => !repository.archived && !repository.fork).slice(0, 3)
      : []
    repositoriesExamined = repositories.length

    const contributorResponses = await Promise.allSettled(repositories.map(async repository => {
      const contributorsUrl = safe(repository.contributors_url)
      if (!contributorsUrl) return { repository, contributors: [] as GitHubContributor[], rate: {} }
      const response = await githubJson<GitHubContributor[]>(
        `${contributorsUrl}?per_page=8&anon=0`,
        fetchImpl,
        token,
      )
      return {
        repository,
        contributors: Array.isArray(response.data) ? response.data : [],
        rate: response,
      }
    }))

    const contributors = new Map<string, AggregatedContributor>()
    contributorResponses.forEach(response => {
      if (response.status === 'rejected') {
        partial = true
        warnings.push(warningFromError(response.reason))
        if (response.reason instanceof GitHubRequestError) {
          rate = mergeRateLimit(rate, response.reason)
        }
        return
      }
      rate = mergeRateLimit(rate, response.value.rate)
      const repository = response.value.repository
      response.value.contributors.forEach(contributor => {
        contributorsExamined += 1
        const login = safe(contributor.login)
        if (!login || contributor.type !== 'User' || isLikelyBotAccount(login)) {
          if (login && isLikelyBotAccount(login)) skippedBots += 1
          return
        }
        const signal: ContributorRepositorySignal = {
          fullName: safe(repository.full_name),
          url: safe(repository.html_url),
          description: safe(repository.description),
          language: safe(repository.language),
          topics: Array.isArray(repository.topics) ? repository.topics.map(safe).filter(Boolean) : [],
          stars: Number(repository.stargazers_count || 0),
          contributions: Number(contributor.contributions || 0),
        }
        const existing = contributors.get(login)
        if (existing) {
          existing.repositories.push(signal)
          existing.totalContributions += signal.contributions
        } else {
          contributors.set(login, {
            contributor,
            repositories: [signal],
            totalContributions: signal.contributions,
          })
        }
      })
    })

    const ranked = Array.from(contributors.values())
      .sort((left, right) =>
        right.repositories.length - left.repositories.length
        || right.totalContributions - left.totalContributions
        || safe(left.contributor.login).localeCompare(safe(right.contributor.login)),
      )
      .slice(0, requestedLimit)

    if (ranked.length) {
      const profileResponses = await Promise.allSettled(ranked.map(async aggregate => {
        const login = safe(aggregate.contributor.login)
        const response = await githubJson<GitHubProfile>(
          `https://api.github.com/users/${encodeURIComponent(login)}`,
          fetchImpl,
          token,
        )
        return { aggregate, profile: response.data, rate: response }
      }))

      const results: SourceResult[] = []
      profileResponses.forEach((response, index) => {
        const aggregate = ranked[index]
        if (response.status === 'rejected') {
          partial = true
          warnings.push(warningFromError(response.reason))
          if (response.reason instanceof GitHubRequestError) rate = mergeRateLimit(rate, response.reason)
          results.push(buildGitHubContributorResult(aggregate, null, req.query, observedAt))
          return
        }
        profilesHydrated += 1
        rate = mergeRateLimit(rate, response.value.rate)
        if (response.value.profile.type === 'User') {
          results.push(buildGitHubContributorResult(aggregate, response.value.profile, req.query, observedAt))
        }
      })
      return finish(results, repositoryQuery)
    }
  } catch (error) {
    partial = true
    warnings.push(warningFromError(error))
    if (error instanceof GitHubRequestError) rate = mergeRateLimit(rate, error)
  }

  strategy = 'user_search_fallback'
  const userQuery = `${req.query} type:user`.trim()
  try {
    const userSearch = await githubJson<{ items?: GitHubContributor[] }>(
      `https://api.github.com/search/users?q=${encodeURIComponent(userQuery)}&per_page=${requestedLimit}`,
      fetchImpl,
      token,
    )
    rate = mergeRateLimit(rate, userSearch)
    const users = Array.isArray(userSearch.data.items)
      ? userSearch.data.items.filter(user => {
        const login = safe(user.login)
        if (isLikelyBotAccount(login)) skippedBots += 1
        return user.type === 'User' && login && !isLikelyBotAccount(login)
      }).slice(0, requestedLimit)
      : []
    contributorsExamined += users.length

    const profiles = await Promise.allSettled(users.map(async user => {
      const login = safe(user.login)
      const response = await githubJson<GitHubProfile>(
        `https://api.github.com/users/${encodeURIComponent(login)}`,
        fetchImpl,
        token,
      )
      return { profile: { ...user, ...response.data }, rate: response }
    }))

    const results: SourceResult[] = []
    profiles.forEach((response, index) => {
      if (response.status === 'rejected') {
        partial = true
        warnings.push(warningFromError(response.reason))
        if (response.reason instanceof GitHubRequestError) rate = mergeRateLimit(rate, response.reason)
        const fallback = buildFallbackUserResult(users[index] as GitHubProfile, req.query, observedAt)
        if (fallback) results.push(fallback)
        return
      }
      profilesHydrated += 1
      rate = mergeRateLimit(rate, response.value.rate)
      const result = buildFallbackUserResult(response.value.profile, req.query, observedAt)
      if (result) results.push(result)
    })
    return finish(results, userQuery)
  } catch (error) {
    warnings.push(warningFromError(error))
    if (error instanceof GitHubRequestError) rate = mergeRateLimit(rate, error)
    return finish([], userQuery)
  }
}
