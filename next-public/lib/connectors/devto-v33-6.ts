import 'server-only'
import type { EvidenceItem, IdentitySignal, SourceResult, SourceSearchRequest } from '@/lib/source-types'

const DEV_API = 'https://dev.to/api'
const USER_AGENT = 'SourcingOS/33.6 (+https://getsourcingos.com)'

function clean(value: unknown, max = 180): string {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, max) : ''
}

function uniq(values: string[], max = 20): string[] {
  return Array.from(new Set(values.map(value => clean(value, 80).toLowerCase()).filter(Boolean))).slice(0, max)
}

function safeUrl(value: unknown): string | undefined {
  const text = clean(value, 500)
  if (!text) return undefined
  try {
    const url = new URL(text)
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : undefined
  } catch {
    return undefined
  }
}

function retrievalTags(req: SourceSearchRequest): string[] {
  const text = req.query.toLowerCase()
  const tags: string[] = []
  const rules: Array<[RegExp, string]> = [
    [/\b(?:rhel|red\s+hat|linux|unix|sysadmin)\b/, 'linux'],
    [/\b(?:devops|sysadmin|infrastructure|platform)\b/, 'devops'],
    [/\bkubernetes\b|\bk8s\b/, 'kubernetes'],
    [/\bterraform\b/, 'terraform'],
    [/\baws\b|amazon web services/, 'aws'],
    [/\bazure\b/, 'azure'],
    [/\bgcp\b|google cloud/, 'gcp'],
    [/\bpython\b/, 'python'],
    [/\btypescript\b/, 'typescript'],
    [/\bjavascript\b/, 'javascript'],
    [/\bjava\b/, 'java'],
    [/\brust\b/, 'rust'],
    [/\bgo(?:lang)?\b/, 'go'],
    [/\bmachine learning\b|\bml\b/, 'machinelearning'],
    [/\bartificial intelligence\b|\bai\b/, 'ai'],
    [/\bsecurity\b|\bcyber/, 'security'],
  ]
  for (const [pattern, tag] of rules) if (pattern.test(text)) tags.push(tag)
  return uniq(tags, 4)
}

async function getJson<T>(url: string): Promise<T> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 6500)
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        accept: 'application/vnd.forem.api-v1+json',
        'user-agent': USER_AGENT,
      },
      cache: 'no-store',
    })
    if (!response.ok) throw new Error(`DEV API ${response.status}`)
    return await response.json() as T
  } finally {
    clearTimeout(timeout)
  }
}

type DevArticle = {
  id?: number
  title?: string
  url?: string
  canonical_url?: string
  tag_list?: string[] | string
  tags?: string
  published_at?: string
  published_timestamp?: string
  user?: {
    name?: string
    username?: string
    github_username?: string
    website_url?: string
    profile_image?: string
  }
}

type DevUser = {
  type_of?: string
  id?: number
  username?: string
  name?: string
  summary?: string
  github_username?: string
  website_url?: string
  location?: string
  profile_image?: string
}

function articleTags(article: DevArticle): string[] {
  if (Array.isArray(article.tag_list)) return uniq(article.tag_list, 12)
  const text = clean(article.tag_list || article.tags, 300)
  return text ? uniq(text.split(/[,\s]+/), 12) : []
}

function observedAt(article: DevArticle): string {
  const candidate = clean(article.published_timestamp || article.published_at, 80)
  return Number.isFinite(Date.parse(candidate)) ? new Date(candidate).toISOString() : new Date().toISOString()
}

function evidenceFor(username: string, articles: DevArticle[]): EvidenceItem[] {
  return articles.slice(0, 5).flatMap(article => {
    const title = clean(article.title, 180) || 'DEV article'
    const url = safeUrl(article.url || article.canonical_url) || `https://dev.to/${username}`
    const tags = articleTags(article)
    const at = observedAt(article)
    const items: EvidenceItem[] = [{
      id: `devto:${username}:article:${article.id || title}`,
      label: 'Public technical writing',
      detail: `${username} authored “${title}” on DEV Community.`,
      source: 'devto',
      confidence: 'high',
      url,
      observedAt: at,
    }]
    if (tags.length) items.push({
      id: `devto:${username}:tags:${article.id || title}`,
      label: 'Observed article tags',
      detail: tags.join(', '),
      source: 'devto',
      confidence: 'medium',
      url,
      observedAt: at,
    })
    return items
  })
}

/**
 * Public DEV/Forem discovery. Retrieval terms select public articles; candidate
 * skills come ONLY from tags observed on articles the person actually authored.
 * Query text itself never becomes a candidate skill or evidence claim.
 */
export async function discoverDevToTalent(req: SourceSearchRequest): Promise<SourceResult[]> {
  const tags = retrievalTags(req)
  if (!tags.length) return []

  const perPage = Math.min(Math.max((req.limit || 8) * 3, 12), 30)
  const articlesUrl = `${DEV_API}/articles?tags=${encodeURIComponent(tags.join(','))}&per_page=${perPage}`
  const articles = await getJson<DevArticle[]>(articlesUrl)
  if (!Array.isArray(articles) || !articles.length) return []

  const byAuthor = new Map<string, DevArticle[]>()
  for (const article of articles) {
    const username = clean(article.user?.username, 80)
    if (!username) continue
    const observed = articleTags(article)
    if (!observed.some(tag => tags.includes(tag))) continue
    const existing = byAuthor.get(username) || []
    existing.push(article)
    byAuthor.set(username, existing)
  }

  const maxPeople = Math.min(req.limit || 8, 8)
  const authors = Array.from(byAuthor.entries()).slice(0, maxPeople)
  const results: SourceResult[] = []

  for (const [username, authored] of authors) {
    const articleUser = authored[0]?.user || {}
    let profile: DevUser = {}
    try {
      profile = await getJson<DevUser>(`${DEV_API}/users/${encodeURIComponent(username)}`)
    } catch {
      profile = {
        username,
        name: articleUser.name,
        github_username: articleUser.github_username,
        website_url: articleUser.website_url,
        profile_image: articleUser.profile_image,
      }
    }

    const name = clean(profile.name || articleUser.name, 120) || username
    const profileUrl = `https://dev.to/${username}`
    const skills = uniq(authored.flatMap(articleTags), 16)
    const location = clean(profile.location, 120)
    const githubUsername = clean(profile.github_username || articleUser.github_username, 80)
    const website = safeUrl(profile.website_url || articleUser.website_url)
    const githubUrl = githubUsername ? `https://github.com/${encodeURIComponent(githubUsername)}` : undefined
    const evidence = evidenceFor(username, authored)
    const identitySignals: IdentitySignal[] = [
      { type: 'name', value: name, weight: 15, source: 'devto' },
      { type: 'source_url', value: profileUrl, weight: 20, source: 'devto' },
      ...(location ? [{ type: 'location' as const, value: location, weight: 12, source: 'devto' as const }] : []),
      ...(website ? [{ type: 'website' as const, value: website, weight: 25, source: 'devto' as const }] : []),
      ...(githubUrl ? [{ type: 'website' as const, value: githubUrl, weight: 35, source: 'devto' as const }] : []),
      ...skills.slice(0, 6).map(skill => ({ type: 'skill' as const, value: skill, weight: 3, source: 'devto' as const })),
    ]

    results.push({
      id: `devto:${username}`,
      source: 'devto',
      sourceProfileId: username,
      entityKind: 'person',
      displayName: name,
      headline: clean(profile.summary, 220) || `DEV Community author with public writing tagged ${skills.slice(0, 4).join(', ') || 'technical topics'}.`,
      location: location || undefined,
      profileUrl,
      avatarUrl: safeUrl(profile.profile_image || articleUser.profile_image),
      skills,
      evidence,
      contactSignals: [
        { type: 'profile_url', value: profileUrl, source: 'devto', verified: false, note: 'Public DEV Community profile URL.' },
        ...(website ? [{ type: 'website' as const, value: website, source: 'devto' as const, verified: false as const, note: 'Public website listed on the DEV profile.' }] : []),
        ...(githubUrl ? [{ type: 'website' as const, value: githubUrl, source: 'devto' as const, verified: false as const, note: 'GitHub username publicly listed on the DEV profile.' }] : []),
        ...(location ? [{ type: 'location' as const, value: location, source: 'devto' as const, verified: false as const, note: 'Location publicly listed on the DEV profile.' }] : []),
      ],
      identitySignals,
      refreshedAt: new Date().toISOString(),
      raw: {
        connectorVersion: 'v33.6-person',
        profile,
        observedTags: skills,
        articleIds: authored.map(article => article.id).filter(Boolean),
      },
    })
  }

  return results
}
