import 'server-only'

import type { EvidenceItem, SourceResult } from '../source-types'

const API = 'https://api.stackexchange.com/2.3'

type InfrastructureSite = 'serverfault' | 'unix'

type PlannedTag = {
  site: InfrastructureSite
  siteLabel: string
  tag: string
  capability: string
}

type StackUser = {
  user_id?: number | string
  display_name?: string
  reputation?: number
  location?: string
  website_url?: string
  link?: string
  profile_image?: string
  user_type?: string
}

type TopAnswererRow = {
  user?: StackUser
  post_count?: number
  score?: number
}

type StackEnvelope<T> = {
  items?: T[]
  backoff?: number
  quota_remaining?: number
}

type AggregatedPerson = {
  site: InfrastructureSite
  siteLabel: string
  user: StackUser
  observations: Array<{ tag: string; capability: string; postCount: number; score: number }>
}

const SITE_LABELS: Record<InfrastructureSite, string> = {
  serverfault: 'Server Fault',
  unix: 'Unix & Linux',
}

const SITE_HOSTS: Record<InfrastructureSite, string> = {
  serverfault: 'serverfault.com',
  unix: 'unix.stackexchange.com',
}

const INFRASTRUCTURE = /\b(?:rhel|red\s*hat|linux|unix|sysadmin|systems?\s+admin(?:istrator)?|server\s+admin(?:istrator)?|selinux|systemd|centos|rocky\s+linux|alma\s*linux|ansible|yum|dnf|rpm|bash|shell)\b/i

function clean(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function positive(value: unknown): number {
  const number = Number(value)
  return Number.isFinite(number) && number > 0 ? Math.trunc(number) : 0
}

function unique<T>(values: T[]): T[] {
  return Array.from(new Set(values))
}

export function isInfrastructureStackExchangeQueryV33_11(query: string, skills: readonly string[] = []): boolean {
  return INFRASTRUCTURE.test(`${query} ${skills.join(' ')}`)
}

/**
 * Job-family-aware Stack Exchange planning. Server Fault and Unix & Linux are
 * much more relevant than Stack Overflow for RHEL/Linux administration, while
 * preserving the same official Stack Exchange API and evidence boundary.
 */
export function planInfrastructureStackExchangeTagsV33_11(
  query: string,
  skills: readonly string[] = [],
): PlannedTag[] {
  const text = `${query} ${skills.join(' ')}`.toLowerCase()
  const capabilities: string[] = []

  if (/\brhel\b|red\s*hat/.test(text)) capabilities.push('RHEL')
  if (/\blinux\b/.test(text)) capabilities.push('Linux')
  if (/\bunix\b/.test(text)) capabilities.push('Unix')
  if (/\bselinux\b/.test(text)) capabilities.push('SELinux')
  if (/\bsystemd\b/.test(text)) capabilities.push('systemd')
  if (/\bcentos\b/.test(text)) capabilities.push('CentOS')
  if (/\brocky\s+linux\b/.test(text)) capabilities.push('Rocky Linux')
  if (/\balma\s*linux\b/.test(text)) capabilities.push('AlmaLinux')
  if (/\bansible\b/.test(text)) capabilities.push('Ansible')
  if (/\byum\b/.test(text)) capabilities.push('yum')
  if (/\bdnf\b/.test(text)) capabilities.push('dnf')
  if (/\brpm\b/.test(text)) capabilities.push('RPM')
  if (/\bbash\b/.test(text)) capabilities.push('Bash')
  if (/\bshell\b/.test(text)) capabilities.push('Shell')

  // A RHEL administrator request should still search the broader Linux
  // administration graph even when the recruiter did not spell out Linux.
  if (capabilities.includes('RHEL') && !capabilities.includes('Linux')) capabilities.push('Linux')

  const ordered = unique(capabilities).slice(0, 4)
  const plan: PlannedTag[] = []

  for (const capability of ordered) {
    const lower = capability.toLowerCase()
    const unixTag = lower === 'rhel' ? 'rhel'
      : lower === 'rocky linux' ? 'rocky-linux'
        : lower === 'almalinux' ? 'almalinux'
          : lower === 'shell' ? 'shell'
            : lower.replace(/\s+/g, '-')
    const serverFaultTag = lower === 'rhel' ? 'redhat'
      : lower === 'rocky linux' ? 'rocky-linux'
        : lower === 'almalinux' ? 'almalinux'
          : lower === 'shell' ? 'shell'
            : lower.replace(/\s+/g, '-')

    plan.push({ site: 'serverfault', siteLabel: SITE_LABELS.serverfault, tag: serverFaultTag, capability })
    plan.push({ site: 'unix', siteLabel: SITE_LABELS.unix, tag: unixTag, capability })
  }

  return plan.slice(0, 8)
}

function stackUrl(site: InfrastructureSite, path: string, params: Record<string, string | number> = {}): string {
  const search = new URLSearchParams({
    site,
    ...Object.fromEntries(Object.entries(params).map(([key, value]) => [key, String(value)])),
  })
  const key = process.env.STACK_EXCHANGE_KEY
  if (key) search.set('key', key)
  return `${API}${path}?${search.toString()}`
}

async function getJson<T>(url: string): Promise<StackEnvelope<T>> {
  const response = await fetch(url, {
    headers: {
      accept: 'application/json',
      'user-agent': 'SourcingOS/1.0 recruiter-controlled-talent-intelligence',
    },
    signal: AbortSignal.timeout(10_000),
  })
  if (!response.ok) throw new Error(`${response.status} from api.stackexchange.com`)
  const json = await response.json() as StackEnvelope<T>
  if (positive(json.backoff)) throw new Error(`Stack Exchange requested a ${positive(json.backoff)}s backoff; retry later.`)
  return json
}

function profileUrl(site: InfrastructureSite, userId: string, user: StackUser): string {
  return clean(user.link) || `https://${SITE_HOSTS[site]}/users/${encodeURIComponent(userId)}`
}

function evidenceFor(
  site: InfrastructureSite,
  siteLabel: string,
  userId: string,
  observations: AggregatedPerson['observations'],
  url: string,
  observedAt: string,
): EvidenceItem[] {
  return observations.slice(0, 8).map(observation => ({
    id: `stackexchange-${site}-${userId}-${observation.tag}`,
    label: `${siteLabel} · ${observation.capability}`,
    detail: `Stack Exchange returned this account among the all-time top answerers for [${observation.tag}] on ${siteLabel}, with ${observation.postCount} answers and an aggregate answer score of ${observation.score}. Observed capability normalization: ${observation.capability}.`,
    source: 'stackoverflow',
    confidence: observation.postCount >= 10 || observation.score >= 50 ? 'high' : 'medium',
    url,
    observedAt,
  }))
}

export function buildInfrastructureStackExchangeResultV33_11(input: {
  site: InfrastructureSite
  user: StackUser
  observations: AggregatedPerson['observations']
  observedAt?: string
}): SourceResult | null {
  const userId = clean(String(input.user.user_id ?? ''))
  if (!userId || input.user.user_type === 'does_not_exist' || !input.observations.length) return null
  const observedAt = input.observedAt || new Date().toISOString()
  const siteLabel = SITE_LABELS[input.site]
  const url = profileUrl(input.site, userId, input.user)
  const name = clean(input.user.display_name) || `${siteLabel} user ${userId}`
  const location = clean(input.user.location)
  const website = clean(input.user.website_url)
  const skills = unique(input.observations.map(observation => observation.capability))
  const evidence = evidenceFor(input.site, siteLabel, userId, input.observations, url, observedAt)
  const reputation = positive(input.user.reputation)
  if (reputation) {
    evidence.push({
      id: `stackexchange-${input.site}-${userId}-reputation`,
      label: `${siteLabel} reputation`,
      detail: `${reputation.toLocaleString()} public ${siteLabel} reputation at observation time.`,
      source: 'stackoverflow',
      confidence: reputation >= 1000 ? 'high' : 'medium',
      url,
      observedAt,
    })
  }

  return {
    id: `stackoverflow:${input.site}:${userId}`,
    source: 'stackoverflow',
    sourceProfileId: `${input.site}:${userId}`,
    entityKind: 'person',
    displayName: name,
    headline: `${siteLabel} · ${skills.join(', ')}${reputation ? ` · ${reputation.toLocaleString()} reputation` : ''}`,
    location: location || undefined,
    profileUrl: url,
    avatarUrl: clean(input.user.profile_image) || undefined,
    skills,
    evidence,
    contactSignals: [
      ...(website ? [{
        type: 'website' as const,
        value: website,
        source: 'stackoverflow' as const,
        verified: false as const,
        note: `Public website listed on the ${siteLabel} profile.`,
      }] : []),
    ],
    identitySignals: [
      { type: 'name', value: name, weight: 15, source: 'stackoverflow' },
      { type: 'source_url', value: url, weight: 18, source: 'stackoverflow' },
      ...(location ? [{ type: 'location' as const, value: location, weight: 12, source: 'stackoverflow' as const }] : []),
      ...(website ? [{ type: 'website' as const, value: website, weight: 25, source: 'stackoverflow' as const }] : []),
      ...skills.slice(0, 5).map(skill => ({ type: 'skill' as const, value: skill, weight: 3, source: 'stackoverflow' as const })),
    ],
    refreshedAt: observedAt,
    raw: {
      stackExchangeSite: input.site,
      stackExchangeSiteLabel: siteLabel,
      profile: input.user,
      observations: input.observations,
      discoveryMethod: 'infrastructure_top_answerers_all_time',
    },
  }
}

export async function discoverInfrastructureStackExchangeTalentV33_11(input: {
  query: string
  skills?: readonly string[]
  limit?: number
}): Promise<{ results: SourceResult[]; plan: PlannedTag[]; warnings: string[] }> {
  const plan = planInfrastructureStackExchangeTagsV33_11(input.query, input.skills || [])
  if (!plan.length) return { results: [], plan, warnings: ['No infrastructure Stack Exchange tags could be derived from this role.'] }

  const people = new Map<string, AggregatedPerson>()
  const warnings: string[] = []

  // Run both infrastructure communities, but keep the request budget bounded.
  for (const item of plan) {
    try {
      const payload = await getJson<TopAnswererRow>(stackUrl(
        item.site,
        `/tags/${encodeURIComponent(item.tag)}/top-answerers/all_time`,
        { pagesize: 20, filter: 'default' },
      ))
      for (const row of payload.items || []) {
        const user = row.user || {}
        const userId = clean(String(user.user_id ?? ''))
        if (!userId || user.user_type === 'does_not_exist') continue
        const key = `${item.site}:${userId}`
        const current = people.get(key) || {
          site: item.site,
          siteLabel: item.siteLabel,
          user,
          observations: [],
        }
        current.user = { ...current.user, ...user }
        if (!current.observations.some(observation => observation.tag === item.tag)) {
          current.observations.push({
            tag: item.tag,
            capability: item.capability,
            postCount: positive(row.post_count),
            score: positive(row.score),
          })
        }
        people.set(key, current)
      }
    } catch (error) {
      warnings.push(`${item.siteLabel} [${item.tag}]: ${error instanceof Error ? error.message : 'Stack Exchange lookup failed.'}`)
    }
  }

  const maxPeople = Math.max(1, Math.min(input.limit ?? 12, 20))
  const ranked = Array.from(people.entries())
    .map(([key, person]) => ({
      key,
      ...person,
      totalScore: person.observations.reduce((sum, observation) => sum + observation.score, 0),
      totalPosts: person.observations.reduce((sum, observation) => sum + observation.postCount, 0),
    }))
    .sort((left, right) =>
      right.observations.length - left.observations.length ||
      right.totalScore - left.totalScore ||
      right.totalPosts - left.totalPosts,
    )
    .slice(0, maxPeople)

  // Profile detail routes are site-scoped, so enrich the shortlisted ids once
  // per community rather than issuing one request per candidate.
  for (const site of ['serverfault', 'unix'] as const) {
    const members = ranked.filter(person => person.site === site)
    if (!members.length) continue
    const ids = members.map(person => clean(String(person.user.user_id ?? ''))).filter(Boolean)
    try {
      const payload = await getJson<StackUser>(stackUrl(site, `/users/${ids.join(';')}`, {
        pagesize: ids.length,
        filter: 'default',
      }))
      for (const user of payload.items || []) {
        const userId = clean(String(user.user_id ?? ''))
        const member = members.find(person => clean(String(person.user.user_id ?? '')) === userId)
        if (member) member.user = { ...member.user, ...user }
      }
    } catch (error) {
      warnings.push(`${SITE_LABELS[site]} profile enrichment: ${error instanceof Error ? error.message : 'Stack Exchange profile lookup failed.'}`)
    }
  }

  const observedAt = new Date().toISOString()
  const results = ranked
    .map(person => buildInfrastructureStackExchangeResultV33_11({
      site: person.site,
      user: person.user,
      observations: person.observations,
      observedAt,
    }))
    .filter((result): result is SourceResult => Boolean(result))

  return { results, plan, warnings }
}
