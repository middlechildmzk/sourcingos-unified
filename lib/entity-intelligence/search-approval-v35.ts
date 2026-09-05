import type { RoleIntake } from '@/lib/role-workspace'
import { entityByIdV35 } from './registry-v35'
import { explicitAlternativeLocationIdsV35, resolveLocationIntentV35 } from './location-v35'
import type { EntityKind, LocationIntentMode } from './types-v35'

const LOCATION_KINDS = new Set<EntityKind>(['place', 'metro', 'region', 'postal_area', 'country', 'state', 'county', 'location'])
const MAX_APPROVED = 40

export type RoleSearchIntelligenceStateV35 = {
  /** Search-strategy state only. This is never recruiter requirement truth or candidate evidence. */
  version: 'v35.3'
  registryVersion: 'v35.2'
  approvedEntityIds: string[]
  approvedLocationExpansionIds: string[]
  updatedAt: string
}

export type ApprovedRetrievalContextV35 = {
  titleTerms: string[]
  capabilityTerms: string[]
  companyTerms: string[]
  industryTerms: string[]
  sensitiveTerms: string[]
  locationTerms: string[]
  approvedLabels: string[]
}

function unique(values: string[], max = MAX_APPROVED): string[] {
  return Array.from(new Set(values.map(value => value.trim()).filter(Boolean))).slice(0, max)
}

function validEntityIds(values: unknown, locationOnly: boolean): string[] {
  if (!Array.isArray(values)) return []
  return unique(values.filter((value): value is string => typeof value === 'string')).filter(id => {
    const entity = entityByIdV35(id)
    if (!entity) return false
    return locationOnly ? LOCATION_KINDS.has(entity.kind) : !LOCATION_KINDS.has(entity.kind)
  })
}

export function normalizeRoleSearchIntelligenceV35(value: unknown): RoleSearchIntelligenceStateV35 | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  const input = value as Record<string, unknown>
  const approvedEntityIds = validEntityIds(input.approvedEntityIds, false)
  const approvedLocationExpansionIds = validEntityIds(input.approvedLocationExpansionIds, true)
  const updatedAt = typeof input.updatedAt === 'string' && Number.isFinite(Date.parse(input.updatedAt))
    ? new Date(input.updatedAt).toISOString()
    : new Date(0).toISOString()

  if (!approvedEntityIds.length && !approvedLocationExpansionIds.length) return undefined
  return {
    version: 'v35.3',
    registryVersion: 'v35.2',
    approvedEntityIds,
    approvedLocationExpansionIds,
    updatedAt,
  }
}

export function isLocationEntityKindV35(kind: EntityKind): boolean {
  return LOCATION_KINDS.has(kind)
}

export function approvedSearchEntityIdsV35(state?: RoleSearchIntelligenceStateV35): string[] {
  return unique([...(state?.approvedEntityIds || []), ...(state?.approvedLocationExpansionIds || [])])
}

export function setApprovedSearchEntityV35(
  current: RoleSearchIntelligenceStateV35 | undefined,
  entityId: string,
  approved: boolean,
  now = new Date(),
): RoleSearchIntelligenceStateV35 | undefined {
  const entity = entityByIdV35(entityId)
  if (!entity) return current
  const normalized = normalizeRoleSearchIntelligenceV35(current)
  let approvedEntityIds = [...(normalized?.approvedEntityIds || [])]
  let approvedLocationExpansionIds = [...(normalized?.approvedLocationExpansionIds || [])]
  const location = LOCATION_KINDS.has(entity.kind)
  const target = location ? approvedLocationExpansionIds : approvedEntityIds
  const next = approved ? unique([...target, entityId]) : target.filter(id => id !== entityId)
  if (location) approvedLocationExpansionIds = next
  else approvedEntityIds = next

  if (!approvedEntityIds.length && !approvedLocationExpansionIds.length) return undefined
  return {
    version: 'v35.3',
    registryVersion: 'v35.2',
    approvedEntityIds,
    approvedLocationExpansionIds,
    updatedAt: now.toISOString(),
  }
}

export function clearApprovedSearchIntelligenceV35(): undefined {
  return undefined
}

function pushByKind(context: ApprovedRetrievalContextV35, id: string): void {
  const entity = entityByIdV35(id)
  if (!entity) return
  const label = entity.canonicalLabel
  context.approvedLabels.push(label)
  if (LOCATION_KINDS.has(entity.kind)) {
    context.locationTerms.push(label)
    return
  }
  if (entity.kind === 'occupation' || entity.kind === 'title') {
    context.titleTerms.push(label)
    return
  }
  if (entity.kind === 'skill' || entity.kind === 'tool' || entity.kind === 'technology' || entity.kind === 'credential' || entity.kind === 'certification') {
    context.capabilityTerms.push(label)
    return
  }
  if (entity.kind === 'company') {
    context.companyTerms.push(label)
    return
  }
  if (entity.kind === 'industry') {
    context.industryTerms.push(label)
    return
  }
  if (entity.kind === 'clearance') context.sensitiveTerms.push(label)
}

export function approvedRetrievalContextV35(state?: RoleSearchIntelligenceStateV35): ApprovedRetrievalContextV35 {
  const context: ApprovedRetrievalContextV35 = {
    titleTerms: [],
    capabilityTerms: [],
    companyTerms: [],
    industryTerms: [],
    sensitiveTerms: [],
    locationTerms: [],
    approvedLabels: [],
  }
  const normalized = normalizeRoleSearchIntelligenceV35(state)
  for (const id of normalized?.approvedEntityIds || []) pushByKind(context, id)
  for (const id of normalized?.approvedLocationExpansionIds || []) pushByKind(context, id)
  for (const key of Object.keys(context) as Array<keyof ApprovedRetrievalContextV35>) context[key] = unique(context[key])
  return context
}

export function approvedExecutionLocationsV35(
  intake: RoleIntake,
  state?: RoleSearchIntelligenceStateV35,
): string[] {
  const rawLocationText = intake.rawDescription || intake.location
  const intent = resolveLocationIntentV35(rawLocationText, intake.location)
  const context = approvedRetrievalContextV35(state)
  const anchor = intent.anchorLabel
    || (intake.location && intake.location !== 'Not specified' ? intake.location : '')
  // Explicit alternatives from the original recruiter sentence are already
  // approved intent. They are different from system-suggested nearby markets,
  // which still require an explicit recruiter click before execution.
  const explicitAlternatives = explicitAlternativeLocationIdsV35(rawLocationText, intent.anchorLocationId)
    .map(id => entityByIdV35(id)?.canonicalLabel || '')
    .filter(Boolean)
  return unique([anchor, ...explicitAlternatives, ...context.locationTerms], 20)
}

export function approvedLocationIntentV35(
  intake: RoleIntake,
  state?: RoleSearchIntelligenceStateV35,
): ReturnType<typeof resolveLocationIntentV35> {
  const intent = resolveLocationIntentV35(intake.rawDescription || intake.location, intake.location)
  const normalized = normalizeRoleSearchIntelligenceV35(state)
  return {
    ...intent,
    recruiterApprovedExpansionIds: normalized?.approvedLocationExpansionIds || [],
  }
}

export function approvedSearchModeLabelV35(mode: LocationIntentMode): string {
  return mode.replace(/_/g, ' ')
}
