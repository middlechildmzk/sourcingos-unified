import type { AgenticSearchSurface } from '../agentic-search-v30'
import type { DomainPackId, DomainPackProfile } from '../domain-packs-v31'
import type { JobFamilyId, JobFamilyRoutingV34 } from '../job-family-router-v34'

export const DOMAIN_EXECUTABLE_SURFACES: readonly AgenticSearchSurface[] = [
  'github',
  'stackoverflow',
  'devto',
  'huggingface',
  'research_publications',
]

const ROUTED = new Set<AgenticSearchSurface>(DOMAIN_EXECUTABLE_SURFACES)

export type SurfaceRoutingAuthority = 'job_family' | 'domain_pack'
export type SurfaceDisposition = 'execute' | 'suppress' | 'routing_declined' | 'not_applicable_to_router'
export type SurfaceRoutingPolicyGap = 'suppressed_without_intelligence' | 'unclassified_occupation'

export type ExecutableSurfaceDecision = {
  surface: AgenticSearchSurface
  disposition: SurfaceDisposition
  decidedBy: SurfaceRoutingAuthority | 'none'
  reason: string
  authorityExpressedOpinion: boolean
  policyGap?: SurfaceRoutingPolicyGap
}

export type ExecutableSurfaceResolution = {
  authority: SurfaceRoutingAuthority
  authorityReason: string
  fallbackReason?: string
  primaryFamily: JobFamilyId
  occupationResolved: boolean
  familyPreferredSurfaces: AgenticSearchSurface[]
  familyDeprioritizedSurfaces: AgenticSearchSurface[]
  domainPackIds: DomainPackId[]
  domainPackExecutableSurfaces: AgenticSearchSurface[]
  routedSurfaces: AgenticSearchSurface[]
  surfaceDispositions: Partial<Record<AgenticSearchSurface, SurfaceDisposition>>
  authorityExpressedOpinion: boolean
  policyGapSurfaces: AgenticSearchSurface[]
  executableSurfaces: AgenticSearchSurface[]
  suppressedSurfaces: AgenticSearchSurface[]
  declinedSurfaces: AgenticSearchSurface[]
  unroutedSurfaces: AgenticSearchSurface[]
  decisions: ExecutableSurfaceDecision[]
}

export type ExecutableSurfaceInput = {
  jobFamilyRouting: JobFamilyRoutingV34
  domainProfile: DomainPackProfile
  surfaces?: readonly AgenticSearchSurface[]
}

function sortedSurfaces(values: Iterable<AgenticSearchSurface>): AgenticSearchSurface[] {
  return Array.from(new Set(values)).sort()
}

export function resolveExecutableSurfaces(input: ExecutableSurfaceInput): ExecutableSurfaceResolution {
  const { jobFamilyRouting, domainProfile } = input
  const primaryFamily = jobFamilyRouting.primaryFamily
  const specializedOccupation = jobFamilyRouting.occupationResolved && primaryFamily !== 'general'
  const familyPreferred = new Set(jobFamilyRouting.preferredPublicSurfaces)
  const familyDeprioritized = new Set(jobFamilyRouting.deprioritizedPublicSurfaces)
  const packIds = Array.from(domainProfile.activeIds).sort()
  const packLabel = packIds.length ? packIds.join(', ') : 'no active pack'

  const authority: SurfaceRoutingAuthority = specializedOccupation ? 'job_family' : 'domain_pack'
  const authorityReason = specializedOccupation
    ? `Job family "${primaryFamily}" is a resolved occupation, so job-family routing is the execution authority for public evidence surfaces.`
    : `No occupational family resolved, so the V34 compatibility path reached domain-pack routing.`
  const fallbackReason = specializedOccupation
    ? undefined
    : `Occupational routing did not resolve a supported family. Domain packs (${packLabel}) are compatibility context only; if they express no source opinion, V35 reports routing_declined instead of pretending suppression was a negative judgment.`

  const candidates = sortedSurfaces(input.surfaces ?? DOMAIN_EXECUTABLE_SURFACES)
  const authorityExpressedOpinion = specializedOccupation
    ? familyPreferred.size > 0 || familyDeprioritized.size > 0
    : domainProfile.executablePublicSurfaces.size > 0

  const decisions: ExecutableSurfaceDecision[] = candidates.map(surface => {
    if (!ROUTED.has(surface)) {
      return {
        surface,
        disposition: 'not_applicable_to_router' as const,
        decidedBy: 'none' as const,
        reason: 'Outside family/domain public-evidence routing; another planner policy controls this surface.',
        authorityExpressedOpinion,
      }
    }

    if (specializedOccupation) {
      if (familyPreferred.has(surface)) {
        return {
          surface,
          disposition: 'execute' as const,
          decidedBy: 'job_family' as const,
          reason: `Preferred public evidence surface for occupational family "${primaryFamily}".`,
          authorityExpressedOpinion,
        }
      }
      if (familyDeprioritized.has(surface)) {
        return {
          surface,
          disposition: 'suppress' as const,
          decidedBy: 'job_family' as const,
          reason: `Explicitly deprioritized for occupational family "${primaryFamily}". This is a source judgment, not a candidate deficiency.`,
          authorityExpressedOpinion,
        }
      }
      return {
        surface,
        disposition: 'suppress' as const,
        decidedBy: 'job_family' as const,
        reason: `Not selected by the resolved occupational family "${primaryFamily}". This does not establish any candidate fact.`,
        authorityExpressedOpinion,
      }
    }

    if (!authorityExpressedOpinion) {
      return {
        surface,
        disposition: 'routing_declined' as const,
        decidedBy: 'domain_pack' as const,
        reason: 'Insufficient occupational/source intelligence. Unknown source suitability is not a negative source judgment.',
        authorityExpressedOpinion: false,
        policyGap: 'unclassified_occupation' as const,
      }
    }

    if (domainProfile.executablePublicSurfaces.has(surface)) {
      return {
        surface,
        disposition: 'execute' as const,
        decidedBy: 'domain_pack' as const,
        reason: `Enabled by compatibility domain-pack routing (${packLabel}) while occupational coverage remains unresolved.`,
        authorityExpressedOpinion,
      }
    }

    return {
      surface,
      disposition: 'suppress' as const,
      decidedBy: 'domain_pack' as const,
      reason: `Not enabled by compatibility domain-pack routing (${packLabel}). Suppression means SourcingOS did not search here, not that a candidate lacks evidence.`,
      authorityExpressedOpinion,
    }
  })

  return {
    authority,
    authorityReason,
    ...(fallbackReason ? { fallbackReason } : {}),
    primaryFamily,
    occupationResolved: jobFamilyRouting.occupationResolved,
    familyPreferredSurfaces: sortedSurfaces(familyPreferred),
    familyDeprioritizedSurfaces: sortedSurfaces(familyDeprioritized),
    domainPackIds: packIds,
    domainPackExecutableSurfaces: sortedSurfaces(domainProfile.executablePublicSurfaces),
    routedSurfaces: [...DOMAIN_EXECUTABLE_SURFACES],
    surfaceDispositions: Object.fromEntries(decisions.map(item => [item.surface, item.disposition])) as Partial<Record<AgenticSearchSurface, SurfaceDisposition>>,
    authorityExpressedOpinion,
    policyGapSurfaces: decisions.filter(item => item.policyGap).map(item => item.surface),
    executableSurfaces: decisions.filter(item => item.disposition === 'execute').map(item => item.surface),
    suppressedSurfaces: decisions.filter(item => item.disposition === 'suppress').map(item => item.surface),
    declinedSurfaces: decisions.filter(item => item.disposition === 'routing_declined').map(item => item.surface),
    unroutedSurfaces: decisions.filter(item => item.disposition === 'not_applicable_to_router').map(item => item.surface),
    decisions,
  }
}

export function surfaceMayExecute(resolution: ExecutableSurfaceResolution, surface: AgenticSearchSurface): boolean {
  if (!ROUTED.has(surface)) return true
  return resolution.surfaceDispositions[surface] === 'execute'
}

export function explainSurfaceRouting(resolution: ExecutableSurfaceResolution): string[] {
  const lines = [resolution.authorityReason]
  if (resolution.fallbackReason) lines.push(resolution.fallbackReason)
  for (const decision of resolution.decisions) {
    if (decision.disposition === 'not_applicable_to_router') continue
    lines.push(`${decision.surface}: ${decision.disposition}. ${decision.reason}`)
  }
  return lines
}
