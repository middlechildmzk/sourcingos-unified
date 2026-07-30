import {
  foldForComparison,
  normalizeDomain,
  normalizeHandle,
  normalizeLocation,
  normalizeOrganization,
  normalizeProfileUrl,
} from './normalization'
import type { CandidateIdentity, IdentityProfile, SimilarityComponents } from './resolver-types'

function clamp(value: number): number {
  return Math.max(0, Math.min(1, value))
}

export function jaroWinkler(leftValue: string, rightValue: string): number {
  const left = leftValue
  const right = rightValue
  if (left === right) return left ? 1 : 0
  if (!left || !right) return 0

  const range = Math.max(0, Math.floor(Math.max(left.length, right.length) / 2) - 1)
  const leftMatches = new Array(left.length).fill(false)
  const rightMatches = new Array(right.length).fill(false)
  let matches = 0

  for (let index = 0; index < left.length; index += 1) {
    const start = Math.max(0, index - range)
    const end = Math.min(index + range + 1, right.length)
    for (let candidate = start; candidate < end; candidate += 1) {
      if (rightMatches[candidate] || left[index] !== right[candidate]) continue
      leftMatches[index] = true
      rightMatches[candidate] = true
      matches += 1
      break
    }
  }

  if (!matches) return 0

  const leftSequence = left.split('').filter((_, index) => leftMatches[index])
  const rightSequence = right.split('').filter((_, index) => rightMatches[index])
  let transpositions = 0
  for (let index = 0; index < leftSequence.length; index += 1) {
    if (leftSequence[index] !== rightSequence[index]) transpositions += 1
  }

  const m = matches
  const jaro = (m / left.length + m / right.length + (m - transpositions / 2) / m) / 3
  let prefix = 0
  while (prefix < Math.min(4, left.length, right.length) && left[prefix] === right[prefix]) prefix += 1
  return clamp(jaro + prefix * 0.1 * (1 - jaro))
}

function bestPairScore(left: string[], right: string[], normalize: (value: string) => string): number | null {
  const a = left.map(normalize).filter(Boolean)
  const b = right.map(normalize).filter(Boolean)
  if (!a.length || !b.length) return null
  let best = 0
  for (const first of a) {
    for (const second of b) best = Math.max(best, jaroWinkler(first, second))
  }
  return best
}

function exactOverlap(left: string[], right: string[], normalize: (value: string) => string): number | null {
  const a = new Set(left.map(normalize).filter(Boolean))
  const b = new Set(right.map(normalize).filter(Boolean))
  if (!a.size || !b.size) return null
  return [...a].some(value => b.has(value)) ? 1 : 0
}

function chronologyCompatibility(incoming: IdentityProfile, existing: IdentityProfile): number | null {
  const left = incoming.chronology ?? []
  const right = existing.chronology ?? []
  if (!left.length || !right.length) return null

  let compatible = 0
  let compared = 0
  for (const a of left) {
    for (const b of right) {
      const sameOrg = a.organization && b.organization
        ? normalizeOrganization(a.organization) === normalizeOrganization(b.organization)
        : false
      if (!sameOrg) continue
      compared += 1
      const aStart = a.startYear ?? -Infinity
      const aEnd = a.endYear ?? Infinity
      const bStart = b.startYear ?? -Infinity
      const bEnd = b.endYear ?? Infinity
      if (Math.max(aStart, bStart) <= Math.min(aEnd, bEnd)) compatible += 1
    }
  }
  if (!compared) return 0.5
  return compatible / compared
}

function profileComponents(incoming: IdentityProfile, existing: IdentityProfile): SimilarityComponents {
  const name = jaroWinkler(foldForComparison(incoming.displayName), foldForComparison(existing.displayName))
  const handle = bestPairScore(incoming.handles, existing.handles, normalizeHandle)
  const location = incoming.location && existing.location
    ? jaroWinkler(normalizeLocation(incoming.location), normalizeLocation(existing.location))
    : null
  const organization = incoming.organization && existing.organization
    ? jaroWinkler(normalizeOrganization(incoming.organization), normalizeOrganization(existing.organization))
    : null
  const personalDomain = exactOverlap(incoming.websites, existing.websites, normalizeDomain)
  const externalLink = exactOverlap(
    [incoming.profileUrl ?? '', ...incoming.explicitLinks],
    [existing.profileUrl ?? '', ...existing.explicitLinks],
    normalizeProfileUrl,
  )

  return {
    name,
    handle,
    location,
    organization,
    personalDomain,
    externalLink,
    chronology: chronologyCompatibility(incoming, existing),
  }
}

export function similarityComponents(incoming: IdentityProfile, candidate: CandidateIdentity): SimilarityComponents {
  const profiles = candidate.sourceProfiles.length
    ? candidate.sourceProfiles
    : [{
        ...incoming,
        id: candidate.id,
        displayName: candidate.canonicalName,
        headline: candidate.headline,
        location: candidate.location,
        organization: candidate.currentCompany,
        handles: [],
        publicEmails: [],
        websites: [],
        explicitLinks: [],
        identifiers: [],
      }]

  const all = profiles.map(profile => profileComponents(incoming, profile))
  const keys: Array<keyof SimilarityComponents> = [
    'name', 'handle', 'location', 'organization', 'personalDomain', 'externalLink', 'chronology',
  ]

  return Object.fromEntries(keys.map(key => {
    const values = all.map(item => item[key]).filter((value): value is number => value !== null)
    return [key, values.length ? Math.max(...values) : null]
  })) as SimilarityComponents
}

export function weightedSimilarity(components: SimilarityComponents): number {
  const weights: Record<keyof SimilarityComponents, number> = {
    name: 0.34,
    handle: 0.12,
    location: 0.08,
    organization: 0.14,
    personalDomain: 0.14,
    externalLink: 0.12,
    chronology: 0.06,
  }

  let weighted = 0
  let availableWeight = 0
  for (const [key, weight] of Object.entries(weights) as Array<[keyof SimilarityComponents, number]>) {
    const value = components[key]
    if (value === null) continue
    weighted += value * weight
    availableWeight += weight
  }
  return availableWeight ? clamp(weighted / availableWeight) : 0
}
