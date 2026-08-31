import 'server-only'

/**
 * GitHub V2 — Technical Talent Graph connector.
 *
 * V1 (`lib/github-person-discovery.ts`) does repository search plus a shallow
 * profile hydrate, and it still copies query terms into `skills` before a
 * downstream guard strips them. V2 replaces that pattern: this connector is
 * structurally incapable of reading the discovery intent when it builds
 * evidence, because `buildGitHubDossier` never receives the intent.
 *
 * Responsibility split between GitHub's two APIs:
 *
 *   GraphQL  — one request returns profile, social accounts, organizations,
 *              owned repositories with languages and topics, and the full
 *              contributionsCollection (commits, PRs, reviews, issues,
 *              repositories contributed to). Requires a token.
 *   REST     — used for discovery (repository and user search, contributor
 *              lists) and as the unauthenticated fallback for profile and
 *              repository data. Contribution counts are not available on the
 *              unauthenticated path, and the dossier says so explicitly rather
 *              than implying the person has no contributions.
 */

import type { SourceName } from '../source-types'
import {
  type ActivityWindow,
  type ConnectorMetadata,
  type DiscoveryIntent,
  type DossierLimit,
  type IdentityAnchor,
  type ObservationProvenance,
  type ObservedTechnology,
  type SourcePerson,
  type TechnicalArtifact,
  type TechnicalDossier,
  observedTechnology,
  retrievalTermText,
} from './contract-v33-3'
import {
  ConnectorRequestLedger,
  SourceRequestError,
  mapWithConcurrency,
} from './request-ledger-v33-3'

const SOURCE: SourceName = 'github'
const REST = 'https://api.github.com'
const GRAPHQL = 'https://api.github.com/graphql'

export const githubConnectorMetadata: ConnectorMetadata = {
  sourceKey: SOURCE,
  label: 'GitHub',
  apiStatus: 'official_authenticated_api',
  capabilities: ['discovery', 'enrichment', 'evidence', 'identity'],
  rateLimitNote:
    'REST core, REST search and GraphQL are separate budgets. Unauthenticated REST is far more restricted than authenticated REST, and GraphQL is priced by query cost rather than request count. This connector budgets requests per run and reports remaining quota from response headers.',
  requiresCredential: false,
  termsNote:
    'Official GitHub APIs only. No scraping, no authenticated-session replay, no bulk mirroring of user data. Public profile fields are used as published.',
}

/* ------------------------------------------------------------------ *
 * Payload shapes (only the fields this connector reads)
 * ------------------------------------------------------------------ */

export type GitHubUserPayload = {
  login?: string
  id?: number | string
  type?: string
  name?: string | null
  bio?: string | null
  company?: string | null
  location?: string | null
  blog?: string | null
  email?: string | null
  html_url?: string
  avatar_url?: string
  created_at?: string
  public_repos?: number
  followers?: number
}

export type GitHubRepositoryPayload = {
  id?: number | string
  name?: string
  full_name?: string
  html_url?: string
  description?: string | null
  fork?: boolean
  archived?: boolean
  topics?: string[]
  language?: string | null
  /** GraphQL only: byte counts per language. */
  languages?: Record<string, number>
  stargazers_count?: number
  forks_count?: number
  created_at?: string
  updated_at?: string
  pushed_at?: string
  owner?: { login?: string }
}

export type GitHubContributionRepositoryPayload = {
  repository: { nameWithOwner?: string; url?: string; isPrivate?: boolean }
  contributions: { totalCount?: number }
}

export type GitHubContributionsPayload = {
  totalCommitContributions?: number
  totalPullRequestContributions?: number
  totalPullRequestReviewContributions?: number
  totalIssueContributions?: number
  totalRepositoriesWithContributedCommits?: number
  contributionYears?: number[]
  commitContributionsByRepository?: GitHubContributionRepositoryPayload[]
  pullRequestContributionsByRepository?: GitHubContributionRepositoryPayload[]
  pullRequestReviewContributionsByRepository?: GitHubContributionRepositoryPayload[]
}

export type GitHubSocialAccount = { provider?: string; url?: string; displayName?: string }
export type GitHubOrganizationPayload = { login?: string; url?: string; name?: string | null }

export type GitHubDossierInput = {
  user: GitHubUserPayload
  repositories: GitHubRepositoryPayload[]
  contributions?: GitHubContributionsPayload | null
  socialAccounts?: GitHubSocialAccount[]
  organizations?: GitHubOrganizationPayload[]
  /** Set when contribution data could not be requested (no credential). */
  contributionsUnavailableReason?: string
  observedAt?: string
}

/* ------------------------------------------------------------------ *
 * Helpers
 * ------------------------------------------------------------------ */

const text = (value: unknown): string => (typeof value === 'string' ? value.trim() : '')
const count = (value: unknown): number => {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : 0
}

const BOT_PATTERN = /(^|[-_])(bot|bots|ci|automation|dependabot|renovate|actions)([-_]|$)/i

export function isLikelyGitHubBot(login: string): boolean {
  const value = login.trim()
  if (!value) return true
  if (value.endsWith('[bot]')) return true
  return BOT_PATTERN.test(value)
}

export function normalizeDomainValue(value: string): string {
  const raw = text(value).toLowerCase()
  if (!raw) return ''
  const withoutScheme = raw.replace(/^[a-z][a-z0-9+.-]*:\/\//, '')
  const host = withoutScheme.split(/[/?#]/)[0].replace(/^www\./, '')
  return /^[a-z0-9.-]+\.[a-z]{2,}$/.test(host) ? host : ''
}

/**
 * Code hosts, package registries and social platforms are not personal
 * domains. Treating `github.com/jane` as a personal-domain anchor would make
 * every GitHub user share an anchor with every other GitHub user.
 */
const NON_PERSONAL_DOMAINS = new Set([
  'github.com', 'gitlab.com', 'bitbucket.org', 'stackoverflow.com', 'stackexchange.com',
  'linkedin.com', 'twitter.com', 'x.com', 'facebook.com', 'instagram.com', 'youtube.com',
  'medium.com', 'dev.to', 'hashnode.dev', 'substack.com', 'notion.site', 'about.me',
  'huggingface.co', 'kaggle.com', 'npmjs.com', 'pypi.org', 'hub.docker.com', 'orcid.org',
  'gist.github.com', 'github.io', 'gitlab.io', 'bsky.app', 'mastodon.social',
])

export function isPersonalDomain(domain: string): boolean {
  if (!domain) return false
  if (NON_PERSONAL_DOMAINS.has(domain)) return false
  // `jane.github.io` is a project page on a shared host, not a personal domain.
  return !Array.from(NON_PERSONAL_DOMAINS).some(known => domain.endsWith(`.${known}`))
}

function provenance(
  sourceField: string,
  sourceRecordId: string,
  observedAt: string,
  basis: ObservationProvenance['basis'] = 'observed_artifact',
  url?: string,
): ObservationProvenance {
  return { source: SOURCE, sourceField, sourceRecordId, basis, url, observedAt }
}

function repositoryArtifactId(repository: GitHubRepositoryPayload): string {
  return `repo:${text(repository.full_name) || text(repository.name) || String(repository.id || '')}`
}

/* ------------------------------------------------------------------ *
 * Relationship classification
 * ------------------------------------------------------------------ */

export const SUBSTANTIAL_CONTRIBUTION_THRESHOLD = 10

/**
 * Owning a fork is not authorship. Appearing once in an activity history is
 * not maintenance. These three states stay distinct all the way to the UI.
 */
export function classifyRepositoryRelationship(
  repository: GitHubRepositoryPayload,
  login: string,
): TechnicalArtifact['relationship'] {
  const owner = text(repository.owner?.login).toLowerCase()
  const isOwner = Boolean(owner) && owner === login.toLowerCase()
  if (isOwner && repository.fork) return 'activity_participant'
  if (isOwner) return 'owner_maintainer'
  return 'unknown'
}

export function classifyContributionRelationship(totalCount: number): TechnicalArtifact['relationship'] {
  return totalCount >= SUBSTANTIAL_CONTRIBUTION_THRESHOLD
    ? 'substantial_contributor'
    : 'activity_participant'
}

/**
 * A repository that is a fork, archived, or has no description, topics, stars
 * or forks is weak evidence on its own. It is still recorded as an artifact.
 * It just does not get to promote a technology to the person level by itself.
 */
export function isSubstantiveRepository(repository: GitHubRepositoryPayload): boolean {
  if (repository.fork) return false
  const stars = count(repository.stargazers_count)
  const forks = count(repository.forks_count)
  const topics = Array.isArray(repository.topics) ? repository.topics.filter(Boolean).length : 0
  const description = text(repository.description)
  return stars >= 1 || forks >= 1 || topics >= 1 || description.length >= 20
}

/* ------------------------------------------------------------------ *
 * Pure dossier builder
 * ------------------------------------------------------------------ */

function repositoryTechnologies(
  repository: GitHubRepositoryPayload,
  observedAt: string,
): ObservedTechnology[] {
  const artifactId = repositoryArtifactId(repository)
  const url = text(repository.html_url) || undefined
  const out: ObservedTechnology[] = []

  const primary = text(repository.language)
  if (primary) {
    const item = observedTechnology(primary, provenance('repository.language', artifactId, observedAt, 'observed_artifact', url))
    if (item) out.push(item)
  }

  for (const [language, bytes] of Object.entries(repository.languages || {})) {
    if (!count(bytes)) continue
    const item = observedTechnology(language, provenance('repository.languages', artifactId, observedAt, 'observed_artifact', url))
    if (item) out.push(item)
  }

  for (const topic of Array.isArray(repository.topics) ? repository.topics : []) {
    const item = observedTechnology(text(topic), provenance('repository.topics', artifactId, observedAt, 'observed_artifact', url))
    if (item) out.push(item)
  }

  return out
}

function repositoryArtifact(
  repository: GitHubRepositoryPayload,
  login: string,
  observedAt: string,
): TechnicalArtifact {
  const relationship = classifyRepositoryRelationship(repository, login)
  return {
    artifactId: repositoryArtifactId(repository),
    source: SOURCE,
    type: 'repository',
    name: text(repository.full_name) || text(repository.name) || 'Unnamed repository',
    url: text(repository.html_url) || undefined,
    description: text(repository.description) || undefined,
    relationship,
    technologies: repositoryTechnologies(repository, observedAt),
    metrics: [
      { key: 'stars', label: 'GitHub stars', value: count(repository.stargazers_count), source: SOURCE },
      { key: 'forks', label: 'GitHub forks', value: count(repository.forks_count), source: SOURCE },
    ],
    createdAt: text(repository.created_at) || undefined,
    updatedAt: text(repository.pushed_at) || text(repository.updated_at) || undefined,
    observedAt,
    derivative: Boolean(repository.fork),
    archived: Boolean(repository.archived),
  }
}

function contributionArtifacts(
  contributions: GitHubContributionsPayload | null | undefined,
  observedAt: string,
): TechnicalArtifact[] {
  if (!contributions) return []
  const out: TechnicalArtifact[] = []

  const build = (
    rows: GitHubContributionRepositoryPayload[] | undefined,
    type: TechnicalArtifact['type'],
    metricKey: string,
    metricLabel: string,
  ) => {
    for (const row of rows || []) {
      if (row?.repository?.isPrivate) continue
      const name = text(row?.repository?.nameWithOwner)
      const total = count(row?.contributions?.totalCount)
      if (!name || !total) continue
      out.push({
        artifactId: `${metricKey}:${name}`,
        source: SOURCE,
        type,
        name,
        url: text(row.repository.url) || `https://github.com/${name}`,
        relationship: classifyContributionRelationship(total),
        // Contribution rows carry no language or topic data. Technologies are
        // deliberately empty here rather than borrowed from the repository
        // search that surfaced the person.
        technologies: [],
        metrics: [{ key: metricKey, label: metricLabel, value: total, source: SOURCE }],
        observedAt,
      })
    }
  }

  build(contributions.commitContributionsByRepository, 'repository_contribution', 'commits', 'Commit contributions')
  build(contributions.pullRequestContributionsByRepository, 'pull_request_activity', 'pull_requests', 'Pull requests')
  build(contributions.pullRequestReviewContributionsByRepository, 'code_review_activity', 'reviews', 'Pull request reviews')

  return out
}

function buildAnchors(input: GitHubDossierInput, login: string, observedAt: string): IdentityAnchor[] {
  const anchors: IdentityAnchor[] = []
  const profileUrl = text(input.user.html_url) || `https://github.com/${login}`

  anchors.push({
    kind: 'github_login',
    value: login,
    normalized: login.toLowerCase(),
    strength: 'deterministic',
    provenance: provenance('user.login', login, observedAt, 'source_stated', profileUrl),
  })

  anchors.push({
    kind: 'source_profile_url',
    value: profileUrl,
    normalized: profileUrl.toLowerCase(),
    strength: 'supporting',
    provenance: provenance('user.html_url', login, observedAt, 'source_stated', profileUrl),
  })

  const blog = text(input.user.blog)
  if (blog) {
    const domain = normalizeDomainValue(blog)
    if (domain && isPersonalDomain(domain)) {
      anchors.push({
        kind: 'personal_domain',
        value: blog.startsWith('http') ? blog : `https://${blog}`,
        normalized: domain,
        strength: 'deterministic',
        provenance: provenance('user.blog', login, observedAt, 'source_stated', profileUrl),
      })
    } else if (domain) {
      anchors.push({
        kind: 'explicit_profile_link',
        value: blog,
        normalized: normalizeDomainValue(blog),
        strength: 'supporting',
        provenance: provenance('user.blog', login, observedAt, 'source_stated', profileUrl),
      })
    }
  }

  const email = text(input.user.email)
  if (email && email.includes('@')) {
    anchors.push({
      kind: 'public_email',
      value: email,
      normalized: email.toLowerCase(),
      strength: 'deterministic',
      provenance: provenance('user.email', login, observedAt, 'source_stated', profileUrl),
    })
  }

  for (const account of input.socialAccounts || []) {
    const url = text(account.url)
    if (!url) continue
    const domain = normalizeDomainValue(url)
    anchors.push({
      kind: domain && isPersonalDomain(domain) ? 'personal_domain' : 'explicit_profile_link',
      value: url,
      normalized: domain || url.toLowerCase(),
      strength: 'deterministic',
      provenance: provenance('user.socialAccounts', login, observedAt, 'source_stated', profileUrl),
    })
  }

  return anchors
}

function buildActivity(
  repositories: GitHubRepositoryPayload[],
  contributions: GitHubContributionsPayload | null | undefined,
  accountCreatedAt: string,
): ActivityWindow {
  const stamps = repositories
    .flatMap(repository => [text(repository.pushed_at), text(repository.updated_at), text(repository.created_at)])
    .filter(Boolean)
    .sort()

  const years = new Set<number>()
  for (const year of contributions?.contributionYears || []) {
    if (Number.isFinite(year)) years.add(Math.trunc(year))
  }
  for (const stamp of stamps) {
    const year = Number(stamp.slice(0, 4))
    if (Number.isFinite(year) && year > 1990) years.add(year)
  }

  return {
    firstObservedAt: accountCreatedAt || stamps[0] || undefined,
    lastObservedAt: stamps[stamps.length - 1] || undefined,
    activeYears: Array.from(years).sort((a, b) => a - b),
  }
}

const STANDING_LIMITS: DossierLimit[] = [
  {
    topic: 'employment history',
    explanation:
      'GitHub does not publish verified employment history. The company field is self-reported by the account holder and is not confirmed by GitHub or by SourcingOS.',
  },
  {
    topic: 'seniority and scope',
    explanation:
      'Public repository activity does not establish job level, team size, production scale, or ownership scope. Those require recruiter or candidate verification.',
  },
  {
    topic: 'private work',
    explanation:
      'Most professional engineering work is not public. Absence of a technology on GitHub is not evidence that the person lacks it.',
  },
]

/**
 * Build a GitHub Technical Dossier from raw payloads.
 *
 * Deliberately pure and intent-free. This function has no parameter through
 * which a search term could reach candidate evidence.
 */
export function buildGitHubDossier(input: GitHubDossierInput): TechnicalDossier | null {
  const login = text(input.user.login)
  if (!login) return null
  if (text(input.user.type) && text(input.user.type) !== 'User') return null

  const observedAt = input.observedAt || new Date().toISOString()
  const profileUrl = text(input.user.html_url) || `https://github.com/${login}`

  const repositories = (input.repositories || []).filter(Boolean)
  const repoArtifacts = repositories.map(repository => repositoryArtifact(repository, login, observedAt))
  const artifacts = [...repoArtifacts, ...contributionArtifacts(input.contributions, observedAt)]

  // Person-level technologies roll up only from substantive original work.
  const supportingRepositories = repositories.filter(isSubstantiveRepository)
  const rollup: ObservedTechnology[] = []
  const supportCounts = new Map<string, number>()
  for (const repository of supportingRepositories) {
    if (classifyRepositoryRelationship(repository, login) !== 'owner_maintainer') continue
    for (const technology of repositoryTechnologies(repository, observedAt)) {
      const key = technology.value.toLowerCase()
      supportCounts.set(key, (supportCounts.get(key) || 0) + 1)
      if (!rollup.some(existing => existing.value.toLowerCase() === key)) rollup.push(technology)
    }
  }

  const limits = [...STANDING_LIMITS]
  if (input.contributionsUnavailableReason) {
    limits.push({
      topic: 'contribution history',
      explanation: `Commit, pull request and review counts were not retrieved for this record. ${input.contributionsUnavailableReason} Treat contribution volume as unknown, not as zero.`,
    })
  }
  if (!supportingRepositories.length && repositories.length) {
    limits.push({
      topic: 'technology evidence',
      explanation:
        'Public repositories were found but none carried a description, topics, stars or forks substantial enough to support a person-level technology claim.',
    })
  }

  const person: SourcePerson = {
    source: SOURCE,
    sourceProfileId: login,
    profileUrl,
    displayName: text(input.user.name) || login,
    headline: text(input.user.bio) || undefined,
    statedOrganization: text(input.user.company).replace(/^@/, '') || undefined,
    statedLocation: text(input.user.location) || undefined,
    websites: [text(input.user.blog), ...(input.socialAccounts || []).map(account => text(account.url))].filter(Boolean),
    publicEmail: text(input.user.email) || undefined,
    avatarUrl: text(input.user.avatar_url) || undefined,
    accountCreatedAt: text(input.user.created_at) || undefined,
  }

  return {
    source: SOURCE,
    person,
    artifacts,
    technologies: rollup,
    anchors: buildAnchors(input, login, observedAt),
    activity: buildActivity(repositories, input.contributions, text(input.user.created_at)),
    limits,
    observedAt,
    raw: {
      strategy: 'github_v2_dossier',
      profile: input.user,
      organizations: input.organizations || [],
      contributionTotals: input.contributions
        ? {
            commits: count(input.contributions.totalCommitContributions),
            pullRequests: count(input.contributions.totalPullRequestContributions),
            reviews: count(input.contributions.totalPullRequestReviewContributions),
            issues: count(input.contributions.totalIssueContributions),
            repositoriesWithCommits: count(input.contributions.totalRepositoriesWithContributedCommits),
          }
        : null,
      technologySupport: Object.fromEntries(supportCounts),
      repositoryCount: repositories.length,
      substantiveRepositoryCount: supportingRepositories.length,
    },
  }
}

/* ------------------------------------------------------------------ *
 * GraphQL
 * ------------------------------------------------------------------ */

export const GITHUB_DOSSIER_QUERY = `query SourcingOSGitHubDossier($login: String!, $repoLimit: Int!) {
  user(login: $login) {
    login
    name
    bio
    company
    location
    websiteUrl
    email
    url
    avatarUrl
    createdAt
    socialAccounts(first: 10) { nodes { provider url displayName } }
    organizations(first: 10) { nodes { login url name } }
    repositories(first: $repoLimit, isFork: false, privacy: PUBLIC, ownerAffiliations: OWNER, orderBy: {field: STARGAZERS, direction: DESC}) {
      nodes {
        databaseId
        name
        nameWithOwner
        url
        description
        isFork
        isArchived
        stargazerCount
        forkCount
        createdAt
        updatedAt
        pushedAt
        primaryLanguage { name }
        languages(first: 8, orderBy: {field: SIZE, direction: DESC}) { edges { size node { name } } }
        repositoryTopics(first: 12) { nodes { topic { name } } }
        owner { login }
      }
    }
    contributionsCollection {
      contributionYears
      totalCommitContributions
      totalPullRequestContributions
      totalPullRequestReviewContributions
      totalIssueContributions
      totalRepositoriesWithContributedCommits
      commitContributionsByRepository(maxRepositories: 25) {
        repository { nameWithOwner url isPrivate }
        contributions { totalCount }
      }
      pullRequestContributionsByRepository(maxRepositories: 25) {
        repository { nameWithOwner url isPrivate }
        contributions { totalCount }
      }
      pullRequestReviewContributionsByRepository(maxRepositories: 25) {
        repository { nameWithOwner url isPrivate }
        contributions { totalCount }
      }
    }
  }
}`

type GraphQlNode = Record<string, any>

/** Translate the GraphQL shape into the REST-flavoured payloads the builder reads. */
export function graphQlUserToDossierInput(node: GraphQlNode, observedAt: string): GitHubDossierInput {
  const repositories: GitHubRepositoryPayload[] = (node?.repositories?.nodes || [])
    .filter(Boolean)
    .map((repo: GraphQlNode) => ({
      id: repo.databaseId,
      name: repo.name,
      full_name: repo.nameWithOwner,
      html_url: repo.url,
      description: repo.description,
      fork: Boolean(repo.isFork),
      archived: Boolean(repo.isArchived),
      topics: (repo?.repositoryTopics?.nodes || []).map((entry: GraphQlNode) => entry?.topic?.name).filter(Boolean),
      language: repo?.primaryLanguage?.name || null,
      languages: Object.fromEntries(
        (repo?.languages?.edges || [])
          .map((edge: GraphQlNode) => [edge?.node?.name, Number(edge?.size || 0)])
          .filter(([name]: [string]) => Boolean(name)),
      ),
      stargazers_count: repo.stargazerCount,
      forks_count: repo.forkCount,
      created_at: repo.createdAt,
      updated_at: repo.updatedAt,
      pushed_at: repo.pushedAt,
      owner: { login: repo?.owner?.login },
    }))

  return {
    user: {
      login: node?.login,
      type: 'User',
      name: node?.name,
      bio: node?.bio,
      company: node?.company,
      location: node?.location,
      blog: node?.websiteUrl,
      email: node?.email,
      html_url: node?.url,
      avatar_url: node?.avatarUrl,
      created_at: node?.createdAt,
    },
    repositories,
    contributions: node?.contributionsCollection || null,
    socialAccounts: (node?.socialAccounts?.nodes || []).filter(Boolean),
    organizations: (node?.organizations?.nodes || []).filter(Boolean),
    observedAt,
  }
}

/* ------------------------------------------------------------------ *
 * Fetch orchestration
 * ------------------------------------------------------------------ */

export type GitHubFetchOptions = {
  ledger: ConnectorRequestLedger
  token?: string
  repoLimit?: number
  observedAt?: string
}

function authHeaders(token?: string): Record<string, string> {
  return token ? { authorization: `Bearer ${token}` } : {}
}

function noteRestQuota(ledger: ConnectorRequestLedger) {
  return (_payload: unknown, response: Response) => {
    const remaining = response.headers?.get?.('x-ratelimit-remaining')
    if (remaining !== null && remaining !== undefined) ledger.noteQuota(Number(remaining))
  }
}

/** Fetch one GitHub dossier, GraphQL first, REST fallback. */
export async function fetchGitHubDossier(
  login: string,
  options: GitHubFetchOptions,
): Promise<TechnicalDossier | null> {
  const { ledger, token } = options
  const observedAt = options.observedAt || new Date().toISOString()
  const repoLimit = Math.max(5, Math.min(options.repoLimit ?? 20, 50))

  if (token) {
    try {
      const payload = await ledger.json<{ data?: { user?: GraphQlNode }; errors?: Array<{ message?: string }> }>(
        `github:graphql:${login}:${repoLimit}`,
        GRAPHQL,
        {
          method: 'POST',
          headers: { ...authHeaders(token), 'content-type': 'application/json' },
          body: JSON.stringify({ query: GITHUB_DOSSIER_QUERY, variables: { login, repoLimit } }),
          inspect: noteRestQuota(ledger),
        },
      )
      if (payload?.errors?.length) {
        ledger.warn(`GitHub GraphQL: ${payload.errors.map(error => error?.message).filter(Boolean).join('; ').slice(0, 200)}`)
      }
      if (payload?.data?.user) {
        return buildGitHubDossier(graphQlUserToDossierInput(payload.data.user, observedAt))
      }
    } catch (error) {
      ledger.warn(
        `GitHub GraphQL dossier failed for ${login}; falling back to REST. ${
          error instanceof Error ? error.message : 'Unknown error.'
        }`,
      )
    }
  }

  try {
    const user = await ledger.json<GitHubUserPayload>(`github:user:${login}`, `${REST}/users/${login}`, {
      headers: authHeaders(token),
      inspect: noteRestQuota(ledger),
    })
    let repositories: GitHubRepositoryPayload[] = []
    try {
      repositories = await ledger.json<GitHubRepositoryPayload[]>(
        `github:repos:${login}:${repoLimit}`,
        `${REST}/users/${login}/repos?per_page=${repoLimit}&sort=pushed&type=owner`,
        { headers: authHeaders(token), inspect: noteRestQuota(ledger) },
      )
    } catch (error) {
      ledger.warn(
        `GitHub repositories unavailable for ${login}. ${error instanceof Error ? error.message : 'Unknown error.'}`,
      )
    }

    return buildGitHubDossier({
      user,
      repositories: Array.isArray(repositories) ? repositories : [],
      contributions: null,
      contributionsUnavailableReason: token
        ? 'The GraphQL contributions query did not return data for this account.'
        : 'No GitHub credential is configured, and contribution counts are only available through the authenticated GraphQL API.',
      observedAt,
    })
  } catch (error) {
    if (error instanceof SourceRequestError && error.status === 404) return null
    ledger.warn(`GitHub profile fetch failed for ${login}. ${error instanceof Error ? error.message : 'Unknown error.'}`)
    return null
  }
}

/* ------------------------------------------------------------------ *
 * Discovery
 * ------------------------------------------------------------------ */

const GITHUB_QUALIFIER_STOPWORDS = new Set([
  'senior', 'staff', 'principal', 'lead', 'engineer', 'engineering', 'developer',
  'architect', 'software', 'experience', 'years', 'must', 'have', 'with', 'and', 'the',
])

/**
 * Turn retrieval intent into a GitHub repository search string.
 * This is the only place in the connector that reads the intent, and its
 * output is a URL, never a candidate field.
 */
export function buildGitHubRepositorySearch(intent: DiscoveryIntent): string {
  const terms = [retrievalTermText(intent.hypothesis), ...intent.capabilityTerms.map(retrievalTermText)]
    .join(' ')
    .toLowerCase()
    .replace(/[^a-z0-9+#./\- ]+/g, ' ')
    .split(/\s+/)
    .map(token => token.trim())
    .filter(token => token.length > 1 && !GITHUB_QUALIFIER_STOPWORDS.has(token))

  const unique = Array.from(new Set(terms)).slice(0, 5)
  const core = unique.length ? unique.join(' ') : 'software'
  return `${core} in:name,description,readme fork:false archived:false`
}

export type GitHubDiscoveryOutcome = {
  dossiers: TechnicalDossier[]
  logins: string[]
}

/**
 * Discover people through repositories that match the retrieval intent, then
 * hydrate each contributor into a full dossier.
 *
 * Repositories are chosen by the search terms. The evidence attached to each
 * person comes from that person's own account, not from the search that found
 * the repository.
 */
export async function discoverGitHubTalent(
  intent: DiscoveryIntent,
  options: GitHubFetchOptions & { maxRepositories?: number; maxPeople?: number },
): Promise<GitHubDiscoveryOutcome> {
  const { ledger, token } = options
  const observedAt = options.observedAt || new Date().toISOString()
  const maxRepositories = Math.max(1, Math.min(options.maxRepositories ?? 5, 10))
  const maxPeople = Math.max(1, Math.min(options.maxPeople ?? intent.limit, 25))
  const query = buildGitHubRepositorySearch(intent)

  let repositories: GitHubRepositoryPayload[] = []
  try {
    const search = await ledger.json<{ items?: GitHubRepositoryPayload[] }>(
      `github:search:repos:${query}:${maxRepositories}`,
      `${REST}/search/repositories?q=${encodeURIComponent(query)}&sort=stars&order=desc&per_page=${maxRepositories}`,
      { headers: authHeaders(token), inspect: noteRestQuota(ledger) },
    )
    repositories = Array.isArray(search?.items) ? search.items : []
  } catch (error) {
    ledger.warn(`GitHub repository search failed. ${error instanceof Error ? error.message : 'Unknown error.'}`)
    ledger.report.partial = true
    return { dossiers: [], logins: [] }
  }

  const logins: string[] = []
  const seen = new Set<string>()

  await mapWithConcurrency(repositories, 3, async repository => {
    const fullName = text(repository.full_name)
    if (!fullName || logins.length >= maxPeople * 2) return
    try {
      const contributors = await ledger.json<Array<{ login?: string; type?: string }>>(
        `github:contributors:${fullName}`,
        `${REST}/repos/${fullName}/contributors?per_page=15&anon=false`,
        { headers: authHeaders(token), inspect: noteRestQuota(ledger) },
      )
      for (const contributor of Array.isArray(contributors) ? contributors : []) {
        const login = text(contributor.login)
        if (!login || contributor.type !== 'User' || isLikelyGitHubBot(login)) continue
        const key = login.toLowerCase()
        if (seen.has(key)) continue
        seen.add(key)
        logins.push(login)
      }
    } catch (error) {
      ledger.warn(
        `GitHub contributor list failed for ${fullName}. ${error instanceof Error ? error.message : 'Unknown error.'}`,
      )
    }
  })

  const selected = logins.slice(0, maxPeople)
  const hydrated = await mapWithConcurrency(selected, 3, login =>
    fetchGitHubDossier(login, { ledger, token, repoLimit: options.repoLimit, observedAt }),
  )

  const dossiers = hydrated.filter((dossier): dossier is TechnicalDossier => Boolean(dossier))
  ledger.report.peopleDiscovered += dossiers.length
  ledger.report.peopleEnriched += dossiers.length
  ledger.report.artifactsObserved += dossiers.reduce((sum, dossier) => sum + dossier.artifacts.length, 0)
  ledger.report.identityAnchorsProduced += dossiers.reduce((sum, dossier) => sum + dossier.anchors.length, 0)
  ledger.report.deterministicAnchorsProduced += dossiers.reduce(
    (sum, dossier) => sum + dossier.anchors.filter(anchor => anchor.strength === 'deterministic').length,
    0,
  )

  return { dossiers, logins: selected }
}
