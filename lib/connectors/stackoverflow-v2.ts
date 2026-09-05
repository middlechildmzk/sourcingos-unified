import 'server-only'

/**
 * Stack Overflow V2 — Technical Talent Graph connector.
 *
 * V33.2 shipped a single discovery strategy: all-time top answerers for up to
 * four guessed tags. V2 keeps that as one strategy among several and adds the
 * evidence depth that makes the source useful.
 *
 * Evidence semantics are strict. Being returned as a top answerer for
 * `kubernetes` is observable community activity. It is not an employment
 * claim, not a duration claim, and not seniority. The dossier says exactly
 * what the API returned and nothing more.
 *
 * Only the official Stack Exchange API is used. The `backoff` field is
 * honoured, and `quota_remaining` is reported to the run ledger.
 */

import type { SourceName } from '../source-types'
import {
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
import { ConnectorRequestLedger, mapWithConcurrency } from './request-ledger-v33-3'

const SOURCE: SourceName = 'stackoverflow'
const API = 'https://api.stackexchange.com/2.3'
const SITE = 'stackoverflow'

/**
 * One site on the Stack Exchange network.
 *
 * The network shares one API, one reputation model, and one user account
 * system, so the same connector serves every site. What it must not share is
 * provenance: an answer written on Server Fault is evidence about
 * infrastructure work, not about Stack Overflow, and the dossier says which.
 */
export type StackSite = {
  /** API `site` slug, e.g. `serverfault`. */
  readonly apiSlug: string
  /** Public host used to build profile and tag URLs. */
  readonly host: string
  readonly source: SourceName
  readonly label: string
}

export const STACK_OVERFLOW_SITE: StackSite = {
  apiSlug: 'stackoverflow',
  host: 'stackoverflow.com',
  source: 'stackoverflow',
  label: 'Stack Overflow',
}

/**
 * Network sites carried beyond Stack Overflow.
 *
 * Chosen for coverage Stack Overflow does not give: Server Fault and Unix &
 * Linux are where system administrators answer, which is a different
 * population from application developers, and the one closest to cleared
 * infrastructure work.
 */
export const STACK_NETWORK_SITES: readonly StackSite[] = [
  { apiSlug: 'serverfault', host: 'serverfault.com', source: 'serverfault', label: 'Server Fault' },
  { apiSlug: 'security', host: 'security.stackexchange.com', source: 'security_se', label: 'Information Security Stack Exchange' },
  { apiSlug: 'devops', host: 'devops.stackexchange.com', source: 'devops_se', label: 'DevOps Stack Exchange' },
  { apiSlug: 'unix', host: 'unix.stackexchange.com', source: 'unix_se', label: 'Unix & Linux Stack Exchange' },
  { apiSlug: 'dba', host: 'dba.stackexchange.com', source: 'dba_se', label: 'Database Administrators Stack Exchange' },
  { apiSlug: 'networkengineering', host: 'networkengineering.stackexchange.com', source: 'networkeng_se', label: 'Network Engineering Stack Exchange' },
]

export const stackOverflowConnectorMetadata: ConnectorMetadata = {
  sourceKey: SOURCE,
  label: 'Stack Overflow',
  apiStatus: 'official_public_api',
  capabilities: ['discovery', 'evidence', 'identity'],
  rateLimitNote:
    'Stack Exchange publishes a daily request quota per application and returns `quota_remaining` on every response. A `backoff` field in any response is a mandatory wait instruction. Several user routes are vectorized and accept batched ids, which this connector uses to keep request counts low.',
  requiresCredential: false,
  termsNote:
    'Official Stack Exchange API only. Respect `backoff`, register an application key for production quota, and attribute content per the Stack Exchange terms. No scraping of question or profile pages.',
}

/* ------------------------------------------------------------------ *
 * Tag planning
 * ------------------------------------------------------------------ */

const STOP_WORDS = new Set([
  'senior', 'staff', 'principal', 'lead', 'engineer', 'engineering', 'developer', 'architect',
  'platform', 'software', 'systems', 'system', 'backend', 'frontend', 'fullstack', 'full', 'stack',
  'and', 'or', 'not', 'with', 'the', 'for', 'from', 'who', 'has', 'have', 'experience',
  'years', 'year', 'must', 'nice', 'required', 'preferred', 'remote', 'hybrid', 'onsite',
  'strong', 'deep', 'real', 'hands', 'proven', 'expert', 'expertise',
])

/**
 * Recruiter vocabulary does not match Stack Overflow tag vocabulary. "AWS" is
 * `amazon-web-services`, "k8s" is `kubernetes`, "SRE" is
 * `site-reliability-engineering`. Unmapped terms are still attempted, because
 * the API is the gate: an unknown tag simply returns nothing.
 */
export const TAG_ALIASES: Record<string, string> = {
  aws: 'amazon-web-services',
  'amazon-web-services': 'amazon-web-services',
  k8s: 'kubernetes',
  kubernetes: 'kubernetes',
  eks: 'amazon-eks',
  terraform: 'terraform',
  pulumi: 'pulumi',
  ansible: 'ansible',
  helm: 'kubernetes-helm',
  golang: 'go',
  go: 'go',
  rust: 'rust',
  node: 'node.js',
  nodejs: 'node.js',
  'node.js': 'node.js',
  react: 'reactjs',
  reactjs: 'reactjs',
  typescript: 'typescript',
  javascript: 'javascript',
  python: 'python',
  java: 'java',
  'c#': 'c#',
  csharp: 'c#',
  'c++': 'c++',
  cpp: 'c++',
  '.net': '.net',
  dotnet: '.net',
  postgres: 'postgresql',
  postgresql: 'postgresql',
  mysql: 'mysql',
  redis: 'redis',
  kafka: 'apache-kafka',
  'apache-kafka': 'apache-kafka',
  spark: 'apache-spark',
  'apache-spark': 'apache-spark',
  docker: 'docker',
  containers: 'docker',
  linux: 'linux',
  azure: 'azure',
  gcp: 'google-cloud-platform',
  'google-cloud': 'google-cloud-platform',
  'google-cloud-platform': 'google-cloud-platform',
  scala: 'scala',
  ruby: 'ruby',
  rails: 'ruby-on-rails',
  'ruby-on-rails': 'ruby-on-rails',
  django: 'django',
  flask: 'flask',
  fastapi: 'fastapi',
  spring: 'spring',
  'spring-boot': 'spring-boot',
  security: 'security',
  cybersecurity: 'security',
  devops: 'devops',
  sre: 'site-reliability-engineering',
  observability: 'observability',
  prometheus: 'prometheus',
  grafana: 'grafana',
  elasticsearch: 'elasticsearch',
  'kubernetes-operator': 'kubernetes-operator',
  istio: 'istio',
  grpc: 'grpc',
  graphql: 'graphql',
  pytorch: 'pytorch',
  tensorflow: 'tensorflow',
  'machine-learning': 'machine-learning',
  ml: 'machine-learning',
}

export type StackTagPlan = {
  readonly primaryTags: string[]
  readonly validationTags: string[]
  readonly unmappedTerms: string[]
}

/**
 * Split retrieval terms into tags to search on and tags to validate against.
 *
 * Primary tags drive discovery requests. Validation tags are checked against
 * each discovered person's own top-answer tags, which is how a multi-skill
 * role gets corroborated without issuing a request per tag per person.
 */
export function planStackOverflowTags(intent: DiscoveryIntent): StackTagPlan {
  const raw = [retrievalTermText(intent.hypothesis), ...intent.capabilityTerms.map(retrievalTermText)]
    .join(' ')
    .toLowerCase()
    .replace(/[()"']/g, ' ')
    .replace(/\b(?:and|or|not)\b/g, ' ')
    .split(/\s+/)
    .map(token => token.replace(/^[^a-z0-9+#.]+|[^a-z0-9+#.-]+$/g, ''))
    .filter(Boolean)
    .filter(token => !STOP_WORDS.has(token))

  const mapped: string[] = []
  const unmapped: string[] = []
  const seen = new Set<string>()

  for (const token of raw) {
    if (token.length < 2 || token.length > 35) continue
    const alias = TAG_ALIASES[token]
    const tag = alias || token
    if (seen.has(tag)) continue
    seen.add(tag)
    if (alias) mapped.push(tag)
    else unmapped.push(tag)
  }

  const ordered = [...mapped, ...unmapped]
  return {
    primaryTags: ordered.slice(0, 3),
    validationTags: ordered.slice(0, 6),
    unmappedTerms: unmapped,
  }
}

/* ------------------------------------------------------------------ *
 * Payload shapes
 * ------------------------------------------------------------------ */

export type StackUserPayload = {
  user_id?: number | string
  display_name?: string
  reputation?: number
  location?: string
  website_url?: string
  link?: string
  profile_image?: string
  creation_date?: number
  last_access_date?: number
  user_type?: string
  answer_count?: number
  accept_rate?: number
}

export type StackTagStat = {
  tag: string
  window: 'all_time' | 'month' | 'quarter' | 'year'
  postCount: number
  score: number
}

export type StackTopAnswerTag = {
  tag: string
  answerCount: number
  answerScore: number
}

export type StackAnswerStat = {
  answerId: string
  tag: string
  score: number
  isAccepted: boolean
  creationDate?: string
  url: string
}

export type StackDossierInput = {
  user: StackUserPayload
  tagStats: StackTagStat[]
  topAnswerTags?: StackTopAnswerTag[]
  answers?: StackAnswerStat[]
  observedAt?: string
  /** Defaults to Stack Overflow so every pre-existing caller is unchanged. */
  site?: StackSite
}

const text = (value: unknown): string => (typeof value === 'string' ? value.trim() : '')
const positive = (value: unknown): number => {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : 0
}

function epochToIso(value: unknown): string | undefined {
  const seconds = Number(value)
  if (!Number.isFinite(seconds) || seconds <= 0) return undefined
  return new Date(seconds * 1000).toISOString()
}

function moduleProvenance(
  sourceField: string,
  sourceRecordId: string,
  observedAt: string,
  url?: string,
  source: SourceName = SOURCE,
): ObservationProvenance {
  return { source, sourceField, sourceRecordId, basis: 'observed_artifact', url, observedAt }
}

function normalizeDomainValue(value: string): string {
  const raw = text(value).toLowerCase()
  if (!raw) return ''
  const withoutScheme = raw.replace(/^[a-z][a-z0-9+.-]*:\/\//, '')
  const host = withoutScheme.split(/[/?#]/)[0].replace(/^www\./, '')
  return /^[a-z0-9.-]+\.[a-z]{2,}$/.test(host) ? host : ''
}

const CODE_HOSTS = new Set(['github.com', 'gitlab.com', 'bitbucket.org', 'huggingface.co', 'kaggle.com'])
const SHARED_HOSTS = new Set([
  'stackoverflow.com', 'stackexchange.com', 'linkedin.com', 'twitter.com', 'x.com',
  'medium.com', 'dev.to', 'about.me', 'github.io', 'substack.com', 'facebook.com',
])

/* ------------------------------------------------------------------ *
 * Pure dossier builder
 * ------------------------------------------------------------------ */

const STANDING_LIMITS: DossierLimit[] = [
  {
    topic: 'employment history',
    explanation:
      'Stack Overflow publishes community activity, not employment. Answer volume under a tag says nothing about job title, employer, or years of professional use.',
  },
  {
    topic: 'current practice',
    explanation:
      'Reputation and answer counts accumulate over an account lifetime. Read the observation timestamps rather than assuming the activity is current.',
  },
]

/**
 * Build a Stack Overflow dossier from API payloads.
 *
 * Pure and intent-free. A tag reaches this function only after Stack Exchange
 * returned that tag *for this specific user*, which is what makes the tag
 * person-level evidence instead of a search term.
 */
export function buildStackOverflowDossier(input: StackDossierInput): TechnicalDossier | null {
  const userId = text(String(input.user.user_id ?? ''))
  if (!userId) return null
  if (input.user.user_type === 'does_not_exist') return null

  const site = input.site || STACK_OVERFLOW_SITE
  // Shadow the module-level Stack Overflow defaults with this site's values so
  // every metric, artifact, and provenance record below names the site the
  // evidence actually came from.
  const SOURCE = site.source
  const provenance = (
    sourceField: string,
    sourceRecordId: string,
    observedAtValue: string,
    url?: string,
  ): ObservationProvenance => moduleProvenance(sourceField, sourceRecordId, observedAtValue, url, site.source)

  const observedAt = input.observedAt || new Date().toISOString()
  const profileUrl = text(input.user.link) || `https://${site.host}/users/${userId}`
  const displayName = text(input.user.display_name) || `${site.label} user ${userId}`

  const technologies: ObservedTechnology[] = []
  const pushTechnology = (value: string, field: string) => {
    const item = observedTechnology(value, provenance(field, userId, observedAt, profileUrl))
    if (item && !technologies.some(existing => existing.value.toLowerCase() === item.value.toLowerCase())) {
      technologies.push(item)
    }
  }

  for (const stat of input.tagStats) pushTechnology(stat.tag, 'tags.top-answerers.user')
  for (const entry of input.topAnswerTags || []) {
    if (entry.answerCount > 0) pushTechnology(entry.tag, 'users.top-answer-tags')
  }

  const artifacts: TechnicalArtifact[] = []

  // Tag expertise records. The person, not a question, is the record here,
  // because that is literally what the top-answerers route returns.
  for (const stat of input.tagStats) {
    artifacts.push({
      artifactId: `so-tag:${userId}:${stat.tag}:${stat.window}`,
      source: SOURCE,
      type: 'qa_answer',
      name: `Top answerer for [${stat.tag}] (${stat.window.replace('_', ' ')})`,
      url: `https://${site.host}/tags/${encodeURIComponent(stat.tag)}/topusers`,
      statement: `Stack Exchange returned this account among the top answerers for [${stat.tag}] over the ${stat.window.replace('_', ' ')} window, with ${stat.postCount} answers and an aggregate answer score of ${stat.score}.`,
      relationship: 'author',
      technologies: [
        ...(observedTechnology(stat.tag, provenance('tags.top-answerers.user', userId, observedAt, profileUrl))
          ? [observedTechnology(stat.tag, provenance('tags.top-answerers.user', userId, observedAt, profileUrl))!]
          : []),
      ],
      metrics: [
        { key: 'tag_post_count', label: `Answers under [${stat.tag}]`, value: stat.postCount, source: SOURCE },
        { key: 'tag_answer_score', label: `Aggregate answer score under [${stat.tag}]`, value: stat.score, source: SOURCE },
      ],
      observedAt,
    })
  }

  for (const answer of input.answers || []) {
    artifacts.push({
      artifactId: `so-answer:${answer.answerId}`,
      source: SOURCE,
      type: 'qa_answer',
      name: `Answer ${answer.answerId} under [${answer.tag}]`,
      url: answer.url,
      statement: answer.isAccepted
        ? `Accepted ${site.label} answer under [${answer.tag}] scoring ${answer.score}.`
        : `${site.label} answer under [${answer.tag}] scoring ${answer.score}.`,
      relationship: 'author',
      technologies: [],
      metrics: [
        { key: 'answer_score', label: 'Answer score', value: answer.score, source: SOURCE },
        { key: 'accepted', label: 'Accepted answer', value: answer.isAccepted ? 1 : 0, source: SOURCE },
      ],
      createdAt: answer.creationDate,
      observedAt,
    })
  }

  const anchors: IdentityAnchor[] = [
    {
      kind: 'stackexchange_user_id',
      value: userId,
      normalized: userId,
      strength: 'deterministic',
      provenance: provenance('user.user_id', userId, observedAt, profileUrl),
    },
    {
      kind: 'source_profile_url',
      value: profileUrl,
      normalized: profileUrl.toLowerCase(),
      strength: 'supporting',
      provenance: provenance('user.link', userId, observedAt, profileUrl),
    },
  ]

  const website = text(input.user.website_url)
  if (website) {
    const domain = normalizeDomainValue(website)
    if (domain && CODE_HOSTS.has(domain)) {
      anchors.push({
        kind: 'explicit_profile_link',
        value: website,
        normalized: website.toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/+$/, ''),
        strength: 'deterministic',
        provenance: provenance('user.website_url', userId, observedAt, profileUrl),
      })
    } else if (domain && !SHARED_HOSTS.has(domain) && !Array.from(SHARED_HOSTS).some(host => domain.endsWith(`.${host}`))) {
      anchors.push({
        kind: 'personal_domain',
        value: website,
        normalized: domain,
        strength: 'deterministic',
        provenance: provenance('user.website_url', userId, observedAt, profileUrl),
      })
    } else if (domain) {
      anchors.push({
        kind: 'explicit_profile_link',
        value: website,
        normalized: domain,
        strength: 'supporting',
        provenance: provenance('user.website_url', userId, observedAt, profileUrl),
      })
    }
  }

  const answerDates = (input.answers || []).map(answer => answer.creationDate).filter(Boolean) as string[]
  const sortedDates = answerDates.slice().sort()
  const years = new Set<number>()
  for (const date of sortedDates) {
    const year = Number(date.slice(0, 4))
    if (Number.isFinite(year) && year > 1990) years.add(year)
  }

  const person: SourcePerson = {
    source: SOURCE,
    sourceProfileId: userId,
    profileUrl,
    displayName,
    headline: `${technologies.length} observed role-relevant Stack Overflow tag${technologies.length === 1 ? '' : 's'} · ${positive(input.user.reputation).toLocaleString()} reputation`,
    statedLocation: text(input.user.location) || undefined,
    websites: website ? [website] : [],
    avatarUrl: text(input.user.profile_image) || undefined,
    accountCreatedAt: epochToIso(input.user.creation_date),
  }

  const limits = [...STANDING_LIMITS]
  if (!answerDates.length) {
    limits.push({
      topic: 'answer recency',
      explanation:
        'Individual answer timestamps were not retrieved for this record, so the currency of the observed tag activity is unknown.',
    })
  }

  return {
    source: SOURCE,
    person,
    artifacts,
    technologies,
    anchors,
    activity: {
      firstObservedAt: epochToIso(input.user.creation_date),
      lastObservedAt: epochToIso(input.user.last_access_date) || sortedDates[sortedDates.length - 1],
      activeYears: Array.from(years).sort((a, b) => a - b),
    },
    limits,
    observedAt,
    raw: {
      strategy: 'stackoverflow_v2_dossier',
      profile: input.user,
      tagStats: input.tagStats,
      topAnswerTags: input.topAnswerTags || [],
      reputation: positive(input.user.reputation),
    },
  }
}

/* ------------------------------------------------------------------ *
 * Fetch orchestration
 * ------------------------------------------------------------------ */

type StackEnvelope<T> = {
  items?: T[]
  backoff?: number
  quota_remaining?: number
  has_more?: boolean
}

function stackUrl(
  path: string,
  params: Record<string, string | number> = {},
  site: StackSite = STACK_OVERFLOW_SITE,
): string {
  const search = new URLSearchParams({ site: site.apiSlug, ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])) })
  const key = process.env.STACK_EXCHANGE_KEY
  if (key) search.set('key', key)
  return `${API}${path}?${search.toString()}`
}

async function stackJson<T>(
  ledger: ConnectorRequestLedger,
  cacheKey: string,
  url: string,
): Promise<StackEnvelope<T>> {
  return ledger.json<StackEnvelope<T>>(cacheKey, url, {
    inspect: payload => {
      const envelope = payload as StackEnvelope<T>
      if (typeof envelope?.quota_remaining === 'number') ledger.noteQuota(envelope.quota_remaining)
      if (positive(envelope?.backoff)) ledger.noteBackoff(positive(envelope.backoff))
    },
  })
}

export type StackDiscoveryStrategy = {
  readonly id: string
  readonly tag: string
  readonly window: StackTagStat['window']
  readonly rationale: string
}

/**
 * Expand a role into several concrete Stack Overflow discovery strategies.
 *
 * "Senior Kubernetes platform engineer with Terraform and AWS" becomes
 * all-time and recent top-answerer passes over kubernetes, terraform and
 * amazon-web-services, rather than one generic keyword request.
 */
export function planStackOverflowStrategies(intent: DiscoveryIntent): StackDiscoveryStrategy[] {
  const plan = planStackOverflowTags(intent)
  const strategies: StackDiscoveryStrategy[] = []

  plan.primaryTags.forEach((tag, index) => {
    strategies.push({
      id: `all_time:${tag}`,
      tag,
      window: 'all_time',
      rationale: `All-time top answerers for [${tag}] surface durable depth in the ${index === 0 ? 'primary' : 'secondary'} capability.`,
    })
  })

  // Recent windows are run only for the leading tags so the request budget
  // stays proportionate to the number of capabilities requested.
  plan.primaryTags.slice(0, 2).forEach(tag => {
    strategies.push({
      id: `month:${tag}`,
      tag,
      window: 'month',
      rationale: `Recent top answerers for [${tag}] surface people who are active now rather than historically.`,
    })
  })

  return strategies
}

export type StackDiscoveryOutcome = {
  dossiers: TechnicalDossier[]
  strategies: StackDiscoveryStrategy[]
  plan: StackTagPlan
}

export async function discoverStackOverflowTalent(
  intent: DiscoveryIntent,
  options: {
    ledger: ConnectorRequestLedger
    observedAt?: string
    maxPeople?: number
    /** Defaults to Stack Overflow, so every pre-existing caller is unchanged. */
    site?: StackSite
  },
): Promise<StackDiscoveryOutcome> {
  const { ledger } = options
  const site = options.site || STACK_OVERFLOW_SITE
  const observedAt = options.observedAt || new Date().toISOString()
  const plan = planStackOverflowTags(intent)
  const strategies = planStackOverflowStrategies(intent)
  const maxPeople = Math.max(1, Math.min(options.maxPeople ?? intent.limit, 25))

  if (!strategies.length) {
    ledger.warn(`No usable ${site.label} tags could be derived from this retrieval intent.`)
    return { dossiers: [], strategies, plan }
  }

  const byUser = new Map<string, { user: StackUserPayload; tagStats: StackTagStat[] }>()

  await mapWithConcurrency(strategies, 2, async strategy => {
    try {
      const payload = await stackJson<{ user?: StackUserPayload; post_count?: number; score?: number }>(
        ledger,
        `so:top-answerers:${strategy.tag}:${strategy.window}`,
        stackUrl(`/tags/${encodeURIComponent(strategy.tag)}/top-answerers/${strategy.window}`, {
          pagesize: 20,
          filter: 'default',
        }, site),
      )
      for (const row of payload.items || []) {
        const user = row?.user || {}
        const userId = text(String(user.user_id ?? ''))
        if (!userId || user.user_type === 'does_not_exist') continue
        const current = byUser.get(userId) || { user, tagStats: [] }
        current.user = { ...current.user, ...user }
        current.tagStats.push({
          tag: strategy.tag,
          window: strategy.window,
          postCount: positive(row?.post_count),
          score: positive(row?.score),
        })
        byUser.set(userId, current)
      }
    } catch (error) {
      ledger.warn(
        `Stack Overflow ${strategy.id} failed. ${error instanceof Error ? error.message : 'Unknown error.'}`,
      )
      ledger.report.partial = true
    }
  })

  if (!byUser.size) return { dossiers: [], strategies, plan }

  // Rank before enrichment so the request budget is spent on the people most
  // likely to be reviewed. Distinct tag coverage outranks raw score: a person
  // strong in three requested capabilities is more interesting than a person
  // enormously strong in one.
  const ranked = Array.from(byUser.entries())
    .map(([userId, value]) => ({
      userId,
      ...value,
      distinctTags: new Set(value.tagStats.map(stat => stat.tag)).size,
      totalScore: value.tagStats.reduce((sum, stat) => sum + stat.score, 0),
    }))
    .sort((a, b) => b.distinctTags - a.distinctTags || b.totalScore - a.totalScore || a.userId.localeCompare(b.userId))
    .slice(0, maxPeople)

  const ids = ranked.map(entry => entry.userId)

  // Vectorized routes: one request for every profile, one for every user's
  // own top-answer tags. This is the difference between 2 requests and 2N.
  try {
    const detail = await stackJson<StackUserPayload>(
      ledger,
      `so:users:${ids.join(',')}`,
      stackUrl(`/users/${ids.join(';')}`, { pagesize: ids.length, filter: 'default' }, site),
    )
    for (const user of detail.items || []) {
      const entry = ranked.find(item => item.userId === text(String(user.user_id ?? '')))
      if (entry) entry.user = { ...entry.user, ...user }
    }
    ledger.report.peopleEnriched += ids.length
  } catch (error) {
    ledger.warn(`Stack Overflow profile enrichment failed. ${error instanceof Error ? error.message : 'Unknown error.'}`)
    ledger.report.partial = true
  }

  const topAnswerTagsByUser = new Map<string, StackTopAnswerTag[]>()
  try {
    const payload = await stackJson<{ user_id?: number; tag_name?: string; answer_count?: number; answer_score?: number }>(
      ledger,
      `so:top-answer-tags:${ids.join(',')}`,
      stackUrl(`/users/${ids.join(';')}/top-answer-tags`, { pagesize: 100, filter: 'default' }, site),
    )
    for (const row of payload.items || []) {
      const userId = text(String(row?.user_id ?? ''))
      const tag = text(row?.tag_name)
      if (!userId || !tag) continue
      const list = topAnswerTagsByUser.get(userId) || []
      list.push({ tag, answerCount: positive(row?.answer_count), answerScore: positive(row?.answer_score) })
      topAnswerTagsByUser.set(userId, list)
    }
  } catch (error) {
    ledger.warn(
      `Stack Overflow top-answer-tag validation failed. ${error instanceof Error ? error.message : 'Unknown error.'}`,
    )
  }

  const dossiers: TechnicalDossier[] = []
  for (const entry of ranked) {
    // Keep only the validation tags the role actually asked about, so the
    // dossier does not fill up with unrelated tag noise.
    const relevantTags = (topAnswerTagsByUser.get(entry.userId) || []).filter(item =>
      plan.validationTags.includes(item.tag),
    )
    const dossier = buildStackOverflowDossier({
      user: entry.user,
      tagStats: entry.tagStats,
      topAnswerTags: relevantTags,
      observedAt,
      site,
    })
    if (dossier) dossiers.push(dossier)
  }

  ledger.report.peopleDiscovered += dossiers.length
  ledger.report.artifactsObserved += dossiers.reduce((sum, dossier) => sum + dossier.artifacts.length, 0)
  ledger.report.identityAnchorsProduced += dossiers.reduce((sum, dossier) => sum + dossier.anchors.length, 0)
  ledger.report.deterministicAnchorsProduced += dossiers.reduce(
    (sum, dossier) => sum + dossier.anchors.filter(anchor => anchor.strength === 'deterministic').length,
    0,
  )

  return { dossiers, strategies, plan }
}
