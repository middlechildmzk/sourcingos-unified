import type {
  CandidateProviderObservationV36_8,
  CandidateProviderProfileUrlV36_8,
  CandidateProviderRichProfileV36_14,
} from './types-v36-8'

export type UnifiedCandidateIdentityClusterV38_2 = {
  mode: 'provisional_display_group'
  confidence: 'high'
  sourceCount: number
  providers: string[]
  anchorKinds: string[]
  observationKeys: string[]
  persistentMergePerformed: false
  reviewRequiredForPersistentMerge: true
}

export type UnifiedCandidateObservationV38_2 = CandidateProviderObservationV36_8 & {
  identityCluster?: UnifiedCandidateIdentityClusterV38_2
}

export type UnifiedCandidateSlateV38_2 = {
  observations: UnifiedCandidateObservationV38_2[]
  rawObservationCount: number
  unifiedCandidateCount: number
  groupedObservationCount: number
  clusters: UnifiedCandidateIdentityClusterV38_2[]
}

const approvedProfessionalHosts = new Set([
  'github.com',
  'stackoverflow.com',
  'kaggle.com',
  'huggingface.co',
  'dev.to',
  'orcid.org',
])

function observationKey(observation: CandidateProviderObservationV36_8): string {
  return `${observation.provider}:${observation.providerPersonId}`
}

export function maskedCandidateNameV38_2(value?: string): boolean {
  const text = String(value || '').trim()
  if (!text) return true
  if (/^(?:private|anonymous|unknown|redacted|linkedin member)(?:\s+(?:member|candidate|profile))?$/i.test(text)) return true
  if (/(?:^|\s)[xX*•]{2,}(?:\s|$)/.test(text)) return true
  if (/^[A-Z][xX*•]{2,}(?:\s+[A-Z][xX*•]{2,})+$/i.test(text)) return true
  return false
}

function normalizedName(value?: string): string {
  if (maskedCandidateNameV38_2(value)) return ''
  return String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function canonicalProfileUrl(entry: CandidateProviderProfileUrlV36_8): { key: string; kind: string } | null {
  const raw = String(entry.url || '').trim()
  if (!raw) return null
  try {
    const parsed = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`)
    const host = parsed.hostname.toLowerCase().replace(/^www\./, '')
    const path = parsed.pathname.replace(/\/+$/, '') || '/'

    // LinkedIn overlap remains useful review context, but existing SourcingOS
    // trust policy deliberately does not make it deterministic identity authority.
    if (host === 'linkedin.com') return null

    const approvedProfessional = approvedProfessionalHosts.has(host)
    const explicitPersonal = entry.kind === 'personal'
    if (!approvedProfessional && !explicitPersonal) return null

    const kind = explicitPersonal && !approvedProfessional ? 'personal_domain' : host
    return { key: `${kind}:${host}${path}`, kind }
  } catch {
    return null
  }
}

function deterministicAnchors(observation: CandidateProviderObservationV36_8): Map<string, string> {
  const anchors = new Map<string, string>()
  for (const entry of observation.profileUrls || []) {
    const canonical = canonicalProfileUrl(entry)
    if (canonical) anchors.set(canonical.key, canonical.kind)
  }
  return anchors
}

function compatibleNames(a: CandidateProviderObservationV36_8, b: CandidateProviderObservationV36_8): boolean {
  const left = normalizedName(a.displayName)
  const right = normalizedName(b.displayName)
  if (!left || !right) return true
  return left === right
}

function sharedAnchorKinds(a: CandidateProviderObservationV36_8, b: CandidateProviderObservationV36_8): string[] {
  const left = deterministicAnchors(a)
  const right = deterministicAnchors(b)
  const kinds = new Set<string>()
  for (const [key, kind] of left) if (right.has(key)) kinds.add(kind)
  return Array.from(kinds).sort()
}

function richness(observation: CandidateProviderObservationV36_8): number {
  let score = 0
  if (!maskedCandidateNameV38_2(observation.displayName)) score += 30
  if (observation.currentTitle || observation.headline) score += 8
  if (observation.currentEmployer) score += 8
  if (observation.location) score += 4
  score += Math.min(12, (observation.skills || []).length)
  score += Math.min(15, (observation.profileUrls || []).length * 3)
  const rich = observation.richProfile
  if (rich?.summary) score += 6
  score += Math.min(12, (rich?.experience || []).length * 3)
  score += Math.min(6, (rich?.education || []).length * 2)
  score += Math.min(6, (rich?.certifications || []).length * 2)
  score += Math.min(6, (rich?.projects || []).length * 2)
  return score
}

function chooseDisplayName(cluster: CandidateProviderObservationV36_8[], primary: CandidateProviderObservationV36_8): string {
  const names = cluster
    .map(item => item.displayName)
    .filter(name => !maskedCandidateNameV38_2(name))
    .sort((a, b) => b.trim().length - a.trim().length)
  return names[0] || primary.displayName
}

function dedupeStrings(values: Array<string | undefined>): string[] {
  const seen = new Set<string>()
  const output: string[] = []
  for (const value of values) {
    const clean = String(value || '').trim()
    if (!clean) continue
    const key = clean.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    output.push(clean)
  }
  return output
}

function mergeProfileUrls(cluster: CandidateProviderObservationV36_8[]): CandidateProviderProfileUrlV36_8[] {
  const output: CandidateProviderProfileUrlV36_8[] = []
  const seen = new Set<string>()
  for (const observation of cluster) {
    for (const item of observation.profileUrls || []) {
      const key = `${item.kind}:${item.url.trim().toLowerCase().replace(/\/+$/, '')}`
      if (seen.has(key)) continue
      seen.add(key)
      output.push(item)
    }
  }
  return output
}

function itemKey(value: unknown): string {
  if (!value || typeof value !== 'object') return String(value || '')
  return JSON.stringify(value, Object.keys(value as Record<string, unknown>).sort())
}

function dedupeObjects<T>(values: T[]): T[] {
  const seen = new Set<string>()
  const output: T[] = []
  for (const value of values) {
    const key = itemKey(value).toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    output.push(value)
  }
  return output
}

function mergeRichProfile(cluster: CandidateProviderObservationV36_8[], primary: CandidateProviderObservationV36_8): CandidateProviderRichProfileV36_14 | undefined {
  const profiles = cluster.map(item => item.richProfile).filter(Boolean) as CandidateProviderRichProfileV36_14[]
  if (!profiles.length) return undefined
  const summaries = profiles.map(item => item.summary).filter(Boolean) as string[]
  const primarySummary = primary.richProfile?.summary
  return {
    ...(primarySummary || summaries.length ? { summary: primarySummary || summaries.sort((a, b) => b.length - a.length)[0] } : {}),
    experience: dedupeObjects(profiles.flatMap(item => item.experience || [])),
    education: dedupeObjects(profiles.flatMap(item => item.education || [])),
    certifications: dedupeObjects(profiles.flatMap(item => item.certifications || [])),
    projects: dedupeObjects(profiles.flatMap(item => item.projects || [])),
  }
}

function mergeAvailability(cluster: CandidateProviderObservationV36_8[], key: 'email' | 'phone'): boolean | 'unknown' {
  const values = cluster.map(item => item.contactAvailability?.[key])
  if (values.includes(true)) return true
  if (values.includes('unknown')) return 'unknown'
  return false
}

function latestIso(values: Array<string | undefined>): string | undefined {
  const valid = values.filter(Boolean) as string[]
  return valid.sort((a, b) => Date.parse(b) - Date.parse(a))[0]
}

function mergeCluster(cluster: CandidateProviderObservationV36_8[], anchorKinds: string[]): UnifiedCandidateObservationV38_2 {
  const primary = [...cluster].sort((a, b) => richness(b) - richness(a) || observationKey(a).localeCompare(observationKey(b)))[0]
  const providers = Array.from(new Set(cluster.map(item => item.provider))).sort()
  const identityCluster: UnifiedCandidateIdentityClusterV38_2 = {
    mode: 'provisional_display_group',
    confidence: 'high',
    sourceCount: cluster.length,
    providers,
    anchorKinds: Array.from(new Set(anchorKinds)).sort(),
    observationKeys: cluster.map(observationKey).sort(),
    persistentMergePerformed: false,
    reviewRequiredForPersistentMerge: true,
  }

  const explanation = cluster.length > 1
    ? `SourcingOS grouped ${cluster.length} source observations into one provisional search result because they share an approved deterministic public-professional identity anchor (${identityCluster.anchorKinds.join(', ')}). This improves the review view only; no persistent identity merge was performed and recruiter review remains required.`
    : ''

  return {
    ...primary,
    displayName: chooseDisplayName(cluster, primary),
    headline: primary.headline || cluster.find(item => item.headline)?.headline,
    currentTitle: primary.currentTitle || cluster.find(item => item.currentTitle)?.currentTitle,
    currentEmployer: primary.currentEmployer || cluster.find(item => item.currentEmployer)?.currentEmployer,
    location: primary.location || cluster.find(item => item.location)?.location,
    skills: dedupeStrings(cluster.flatMap(item => item.skills || [])),
    profileUrls: mergeProfileUrls(cluster),
    contactAvailability: {
      email: mergeAvailability(cluster, 'email'),
      phone: mergeAvailability(cluster, 'phone'),
    },
    richProfile: mergeRichProfile(cluster, primary),
    observedAt: latestIso(cluster.map(item => item.observedAt)) || primary.observedAt,
    refreshedAt: latestIso(cluster.map(item => item.refreshedAt)) || primary.refreshedAt,
    providerExplanation: [primary.providerExplanation, explanation].filter(Boolean).join(' '),
    identityCluster,
  }
}

/**
 * Build a richer, lower-duplication slate without silently changing durable
 * identity. Only independently observed exact public-professional anchors can
 * group records. Names/employers/locations never create a group by themselves,
 * and LinkedIn overlap remains review context rather than deterministic authority.
 */
export function buildUnifiedCandidateSlateV38_2(observations: CandidateProviderObservationV36_8[]): UnifiedCandidateSlateV38_2 {
  const count = observations.length
  if (count <= 1) {
    return { observations: observations as UnifiedCandidateObservationV38_2[], rawObservationCount: count, unifiedCandidateCount: count, groupedObservationCount: 0, clusters: [] }
  }

  const parent = observations.map((_, index) => index)
  const find = (value: number): number => {
    let current = value
    while (parent[current] !== current) {
      parent[current] = parent[parent[current]]
      current = parent[current]
    }
    return current
  }
  const union = (a: number, b: number) => {
    const left = find(a)
    const right = find(b)
    if (left !== right) parent[right] = left
  }

  const pairKinds = new Map<string, string[]>()
  for (let i = 0; i < observations.length; i += 1) {
    for (let j = i + 1; j < observations.length; j += 1) {
      if (!compatibleNames(observations[i], observations[j])) continue
      const kinds = sharedAnchorKinds(observations[i], observations[j])
      if (!kinds.length) continue
      union(i, j)
      pairKinds.set(`${i}:${j}`, kinds)
    }
  }

  const groups = new Map<number, number[]>()
  for (let index = 0; index < observations.length; index += 1) {
    const root = find(index)
    const group = groups.get(root) || []
    group.push(index)
    groups.set(root, group)
  }

  const unified: UnifiedCandidateObservationV38_2[] = []
  const clusters: UnifiedCandidateIdentityClusterV38_2[] = []
  let groupedObservationCount = 0

  for (const indexes of groups.values()) {
    if (indexes.length === 1) {
      unified.push(observations[indexes[0]])
      continue
    }
    const kinds = new Set<string>()
    for (let a = 0; a < indexes.length; a += 1) {
      for (let b = a + 1; b < indexes.length; b += 1) {
        for (const kind of pairKinds.get(`${Math.min(indexes[a], indexes[b])}:${Math.max(indexes[a], indexes[b])}`) || []) kinds.add(kind)
      }
    }
    const merged = mergeCluster(indexes.map(index => observations[index]), Array.from(kinds))
    unified.push(merged)
    if (merged.identityCluster) clusters.push(merged.identityCluster)
    groupedObservationCount += indexes.length - 1
  }

  // Preserve source-interleaving intent as much as possible by ordering clusters
  // according to the earliest raw observation they contain.
  const rawPosition = new Map(observations.map((item, index) => [observationKey(item), index]))
  unified.sort((a, b) => {
    const aKeys = a.identityCluster?.observationKeys || [observationKey(a)]
    const bKeys = b.identityCluster?.observationKeys || [observationKey(b)]
    const aPos = Math.min(...aKeys.map(key => rawPosition.get(key) ?? Number.MAX_SAFE_INTEGER))
    const bPos = Math.min(...bKeys.map(key => rawPosition.get(key) ?? Number.MAX_SAFE_INTEGER))
    return aPos - bPos
  })

  return {
    observations: unified,
    rawObservationCount: count,
    unifiedCandidateCount: unified.length,
    groupedObservationCount,
    clusters,
  }
}
