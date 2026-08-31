import 'server-only'
import type { EvidenceItem, SourceResult } from './source-types'

const API = 'https://api.stackexchange.com/2.3'
const observedAt = () => new Date().toISOString()

const STOP_WORDS = new Set([
  'senior', 'staff', 'principal', 'lead', 'engineer', 'engineering', 'developer', 'architect',
  'platform', 'software', 'systems', 'system', 'backend', 'frontend', 'fullstack', 'full', 'stack',
  'and', 'or', 'not', 'with', 'the', 'for', 'from', 'who', 'has', 'have', 'experience',
  'years', 'year', 'must', 'nice', 'required', 'preferred', 'remote', 'hybrid', 'onsite',
])

const TAG_ALIASES: Record<string, string> = {
  aws: 'amazon-web-services',
  'amazon-web-services': 'amazon-web-services',
  k8s: 'kubernetes',
  kubernetes: 'kubernetes',
  terraform: 'terraform',
  golang: 'go',
  go: 'go',
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
  linux: 'linux',
  azure: 'azure',
  gcp: 'google-cloud-platform',
  'google-cloud': 'google-cloud-platform',
  'google-cloud-platform': 'google-cloud-platform',
  rust: 'rust',
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
}

function unique<T>(values: T[]): T[] {
  return Array.from(new Set(values))
}

function safeText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function tagCandidates(query: string): string[] {
  const tokens = query
    .toLowerCase()
    .replace(/[()"']/g, ' ')
    .replace(/\b(?:and|or|not)\b/g, ' ')
    .split(/\s+/)
    .map(token => token.replace(/^[^a-z0-9+#.]+|[^a-z0-9+#.-]+$/g, ''))
    .filter(Boolean)

  const tags = tokens
    .filter(token => !STOP_WORDS.has(token))
    .map(token => TAG_ALIASES[token] || token)
    .filter(tag => tag.length >= 2 && tag.length <= 35)

  // Prefer terms that have a known Stack Overflow alias, then preserve a few
  // additional role terms for niche ecosystems. The API itself is the evidence
  // gate: a tag is attached to a person only after top-answerer data is returned.
  const known = tags.filter(tag => Object.values(TAG_ALIASES).includes(tag))
  const other = tags.filter(tag => !known.includes(tag))
  return unique([...known, ...other]).slice(0, 4)
}

async function getJson(url: string): Promise<any> {
  const response = await fetch(url, {
    headers: { accept: 'application/json', 'user-agent': 'SourcingOS/1.0 recruiter-controlled-talent-intelligence' },
    signal: AbortSignal.timeout(12000),
  })
  if (!response.ok) throw new Error(`${response.status} from api.stackexchange.com`)
  const json = await response.json() as any
  if (Number(json?.backoff || 0) > 0) throw new Error(`Stack Exchange requested a ${Number(json.backoff)}s backoff; retry later.`)
  return json
}

type TagStat = { tag: string; postCount: number; score: number }
type AggregatedUser = { user: any; tagStats: TagStat[] }

function evidenceFor(userId: string, tagStats: TagStat[], profileUrl: string): EvidenceItem[] {
  return tagStats.slice(0, 6).map(stat => ({
    id: `stackoverflow-${userId}-${stat.tag}`,
    label: `Stack Overflow · ${stat.tag}`,
    detail: `Top-answerer signal for [${stat.tag}]: ${stat.postCount} posts and ${stat.score} aggregate answer score in the public Stack Exchange result.`,
    source: 'stackoverflow',
    confidence: stat.postCount >= 10 || stat.score >= 50 ? 'high' : 'medium',
    url: profileUrl,
    observedAt: observedAt(),
  }))
}

/**
 * Discover technical people through observed Stack Overflow tag expertise.
 * Search terms choose which public tags to investigate, but a tag becomes a
 * candidate skill only when Stack Exchange returns that user as a top answerer
 * for the tag. No query-only skill promotion is allowed.
 */
export async function searchStackOverflowTalent(input: {
  query: string
  limit?: number
}): Promise<{ results: SourceResult[]; tags: string[]; warnings: string[] }> {
  const tags = tagCandidates(input.query)
  if (!tags.length) return { results: [], tags: [], warnings: ['No usable Stack Overflow tags could be derived from this search hypothesis.'] }

  const people = new Map<string, AggregatedUser>()
  const warnings: string[] = []

  for (const tag of tags) {
    try {
      const data = await getJson(`${API}/tags/${encodeURIComponent(tag)}/top-answerers/all_time?site=stackoverflow&pagesize=20&filter=default`)
      for (const row of Array.isArray(data?.items) ? data.items : []) {
        const user = row?.user || {}
        const userId = String(user.user_id || '').trim()
        if (!userId || user.user_type === 'does_not_exist') continue
        const current = people.get(userId) || { user, tagStats: [] }
        current.user = { ...current.user, ...user }
        current.tagStats.push({
          tag,
          postCount: Math.max(0, Number(row.post_count || 0)),
          score: Math.max(0, Number(row.score || 0)),
        })
        people.set(userId, current)
      }
    } catch (error) {
      warnings.push(`${tag}: ${error instanceof Error ? error.message : 'Stack Overflow tag lookup failed.'}`)
    }
  }

  const ids = Array.from(people.keys()).slice(0, 100)
  if (!ids.length) return { results: [], tags, warnings }

  try {
    const detail = await getJson(`${API}/users/${ids.join(';')}?site=stackoverflow&pagesize=${ids.length}&filter=default`)
    for (const user of Array.isArray(detail?.items) ? detail.items : []) {
      const userId = String(user.user_id || '')
      const current = people.get(userId)
      if (current) current.user = { ...current.user, ...user }
    }
  } catch (error) {
    warnings.push(error instanceof Error ? `Profile enrichment: ${error.message}` : 'Stack Overflow profile enrichment failed.')
  }

  const ranked = Array.from(people.entries())
    .map(([userId, value]) => ({
      userId,
      ...value,
      totalScore: value.tagStats.reduce((sum, stat) => sum + stat.score, 0),
      totalPosts: value.tagStats.reduce((sum, stat) => sum + stat.postCount, 0),
    }))
    .sort((a, b) => b.tagStats.length - a.tagStats.length || b.totalScore - a.totalScore || b.totalPosts - a.totalPosts)
    .slice(0, Math.max(1, Math.min(input.limit ?? 12, 20)))

  const results: SourceResult[] = ranked.map(item => {
    const user = item.user || {}
    const name = safeText(user.display_name) || `Stack Overflow user ${item.userId}`
    const profileUrl = safeText(user.link) || `https://stackoverflow.com/users/${item.userId}`
    const location = safeText(user.location)
    const website = safeText(user.website_url)
    const observedTags = unique(item.tagStats.map(stat => stat.tag))
    const evidence = evidenceFor(item.userId, item.tagStats, profileUrl)
    const reputation = Math.max(0, Number(user.reputation || 0))
    if (reputation) {
      evidence.push({
        id: `stackoverflow-${item.userId}-reputation`,
        label: 'Stack Overflow reputation',
        detail: `${reputation.toLocaleString()} public Stack Overflow reputation at observation time.`,
        source: 'stackoverflow',
        confidence: reputation >= 1000 ? 'high' : 'medium',
        url: profileUrl,
        observedAt: observedAt(),
      })
    }

    return {
      id: `stackoverflow:${item.userId}`,
      source: 'stackoverflow',
      sourceProfileId: item.userId,
      entityKind: 'person',
      displayName: name,
      headline: `${observedTags.length} observed role-relevant Stack Overflow tag${observedTags.length === 1 ? '' : 's'} · ${reputation.toLocaleString()} reputation`,
      location: location || undefined,
      profileUrl,
      avatarUrl: safeText(user.profile_image) || undefined,
      skills: observedTags,
      evidence,
      contactSignals: [
        ...(website ? [{ type: 'website' as const, value: website, source: 'stackoverflow' as const, verified: false as const, note: 'Public website listed on Stack Overflow profile.' }] : []),
      ],
      identitySignals: [
        { type: 'name', value: name, weight: 15, source: 'stackoverflow' },
        ...(location ? [{ type: 'location' as const, value: location, weight: 12, source: 'stackoverflow' as const }] : []),
        ...(website ? [{ type: 'website' as const, value: website, weight: 25, source: 'stackoverflow' as const }] : []),
        ...observedTags.slice(0, 5).map(tag => ({ type: 'skill' as const, value: tag, weight: 3, source: 'stackoverflow' as const })),
      ],
      refreshedAt: observedAt(),
      raw: {
        profile: user,
        observedTags,
        tagStats: item.tagStats,
        discoveryMethod: 'top_answerers_all_time',
      },
    }
  })

  return { results, tags, warnings }
}

export const stackOverflowTagCandidatesForTest = tagCandidates
