export type EmploymentEvidenceClassV36 =
  | 'profile_statement'
  | 'github_org_participation'
  | 'email_domain_affiliation'
  | 'provider_assertion'

export type EmploymentCurrentStateV36 = 'current' | 'historical' | 'unknown'

export type EmploymentObservationV36 = {
  observationId: string
  candidateId: string
  sourceProfileId?: string
  companyName: string
  title?: string
  evidenceClass: EmploymentEvidenceClassV36
  currentState: EmploymentCurrentStateV36
  source: string
  sourceUrl?: string
  observedAt?: string
  retrievedAt?: string
  conflictGroup?: string
  explanation: string
}

export type CandidateRoleHistoryV36 = {
  roleId: string
  stage?: string
  fitDecision?: string
  fitReasons: string[]
  concerns: string[]
  firstSeenAt?: string
  lastSeenAt?: string
}

export type CandidateRediscoveryStateV36 =
  | 'already_in_role'
  | 'rediscovered_from_other_role'
  | 'known_to_sourcingos'

export type CandidateUniverseProjectionV36 = {
  candidateId: string
  knownToSourcingOS: true
  sourceProfileCount: number
  evidenceItemCount: number
  firstSeenAt?: string
  lastSeenAt?: string
  roleCount: number
  roleHistory: CandidateRoleHistoryV36[]
  rediscoveryState: CandidateRediscoveryStateV36
  employmentObservations: EmploymentObservationV36[]
  trustBoundary: string
}

type SourceProfileLike = {
  id?: string | null
  candidate_id?: string | null
  source?: string | null
  source_profile_id?: string | null
  profile_url?: string | null
  headline?: string | null
  organization?: string | null
  raw?: unknown
  last_seen_at?: string | null
  created_at?: string | null
}

type EvidenceLike = {
  candidate_id?: string | null
  created_at?: string | null
}

type RoleCandidateLike = {
  candidate_id?: string | null
  role_id?: string | null
  stage?: string | null
  fit_decision?: string | null
  fit_reasons?: unknown
  concerns?: unknown
  added_at?: string | null
  updated_at?: string | null
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function stringList(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.map(text).filter(Boolean)
}

function isoMin(values: Array<string | undefined>): string | undefined {
  const valid = values.filter((value): value is string => Boolean(value)).sort()
  return valid[0]
}

function isoMax(values: Array<string | undefined>): string | undefined {
  const valid = values.filter((value): value is string => Boolean(value)).sort()
  return valid[valid.length - 1]
}

function asObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

function githubOrganizations(raw: unknown): Array<{ login?: string; name?: string; url?: string }> {
  const object = asObject(raw)
  if (!object) return []

  const candidates: unknown[] = [
    object.organizations,
    asObject(object.raw)?.organizations,
    asObject(object.dossier)?.organizations,
    asObject(asObject(object.dossier)?.raw)?.organizations,
  ]

  for (const candidate of candidates) {
    if (!Array.isArray(candidate)) continue
    return candidate
      .map(item => asObject(item))
      .filter((item): item is Record<string, unknown> => Boolean(item))
      .map(item => ({
        login: text(item.login) || undefined,
        name: text(item.name) || undefined,
        url: text(item.url) || undefined,
      }))
  }
  return []
}

/**
 * Build role-independent employment observations from source-profile data.
 *
 * Important: these are observations, not resolved employment facts. An undated
 * profile company defaults to `unknown` currentness. GitHub organization
 * membership is always a participation signal and never employment.
 */
export function buildEmploymentObservationsV36(
  candidateId: string,
  profiles: SourceProfileLike[],
): EmploymentObservationV36[] {
  const observations: EmploymentObservationV36[] = []
  const seen = new Set<string>()

  for (const profile of profiles) {
    const source = text(profile.source) || 'unknown'
    const sourceProfileId = text(profile.id) || undefined
    const observedAt = text(profile.last_seen_at) || text(profile.created_at) || undefined
    const sourceUrl = text(profile.profile_url) || undefined
    const companyName = text(profile.organization)
    const title = text(profile.headline) || undefined

    if (companyName) {
      const key = `profile:${source}:${sourceProfileId || text(profile.source_profile_id)}:${companyName.toLowerCase()}`
      if (!seen.has(key)) {
        seen.add(key)
        observations.push({
          observationId: key,
          candidateId,
          sourceProfileId,
          companyName,
          title,
          evidenceClass: 'profile_statement',
          currentState: 'unknown',
          source,
          sourceUrl,
          observedAt,
          retrievedAt: observedAt,
          conflictGroup: `employment:${candidateId}:profile`,
          explanation: source === 'github'
            ? 'GitHub profile company is self-reported by the account holder. It is not verified employment and its currentness is unknown.'
            : 'Source profile states an organization, but no dated employment interval is attached. Currentness remains unknown.',
        })
      }
    }

    if (source === 'github') {
      for (const organization of githubOrganizations(profile.raw)) {
        const orgName = organization.name || organization.login
        if (!orgName) continue
        const key = `github_org:${sourceProfileId || text(profile.source_profile_id)}:${orgName.toLowerCase()}`
        if (seen.has(key)) continue
        seen.add(key)
        observations.push({
          observationId: key,
          candidateId,
          sourceProfileId,
          companyName: orgName,
          evidenceClass: 'github_org_participation',
          currentState: 'unknown',
          source: 'github',
          sourceUrl: organization.url || sourceUrl,
          observedAt,
          retrievedAt: observedAt,
          explanation: 'GitHub organization membership is a public platform relationship. It does not establish employment, title, tenure, or current employer.',
        })
      }
    }
  }

  return observations
}

export function buildCandidateRoleHistoryV36(rows: RoleCandidateLike[]): CandidateRoleHistoryV36[] {
  const byRole = new Map<string, CandidateRoleHistoryV36>()

  for (const row of rows) {
    const roleId = text(row.role_id)
    if (!roleId) continue
    const existing = byRole.get(roleId)
    const firstSeenAt = text(row.added_at) || undefined
    const lastSeenAt = text(row.updated_at) || firstSeenAt
    const next: CandidateRoleHistoryV36 = {
      roleId,
      stage: text(row.stage) || existing?.stage,
      fitDecision: text(row.fit_decision) || existing?.fitDecision,
      fitReasons: Array.from(new Set([...(existing?.fitReasons || []), ...stringList(row.fit_reasons)])),
      concerns: Array.from(new Set([...(existing?.concerns || []), ...stringList(row.concerns)])),
      firstSeenAt: isoMin([existing?.firstSeenAt, firstSeenAt]),
      lastSeenAt: isoMax([existing?.lastSeenAt, lastSeenAt]),
    }
    byRole.set(roleId, next)
  }

  return Array.from(byRole.values()).sort((a, b) => (b.lastSeenAt || '').localeCompare(a.lastSeenAt || ''))
}

export function buildCandidateUniverseProjectionV36(input: {
  candidateId: string
  profiles: SourceProfileLike[]
  evidenceItems: EvidenceLike[]
  roleCandidates: RoleCandidateLike[]
  activeRoleId?: string
  candidateCreatedAt?: string
  candidateUpdatedAt?: string
}): CandidateUniverseProjectionV36 {
  const roleHistory = buildCandidateRoleHistoryV36(input.roleCandidates)
  const activeRoleId = text(input.activeRoleId)
  const alreadyInRole = Boolean(activeRoleId && roleHistory.some(role => role.roleId === activeRoleId))
  const hasOtherRole = roleHistory.some(role => !activeRoleId || role.roleId !== activeRoleId)

  const sourceTimes = input.profiles.flatMap(profile => [text(profile.created_at) || undefined, text(profile.last_seen_at) || undefined])
  const evidenceTimes = input.evidenceItems.map(item => text(item.created_at) || undefined)
  const roleTimes = roleHistory.flatMap(role => [role.firstSeenAt, role.lastSeenAt])

  return {
    candidateId: input.candidateId,
    knownToSourcingOS: true,
    sourceProfileCount: input.profiles.length,
    evidenceItemCount: input.evidenceItems.length,
    firstSeenAt: isoMin([input.candidateCreatedAt, ...sourceTimes, ...evidenceTimes, ...roleTimes]),
    lastSeenAt: isoMax([input.candidateUpdatedAt, ...sourceTimes, ...evidenceTimes, ...roleTimes]),
    roleCount: roleHistory.length,
    roleHistory,
    rediscoveryState: alreadyInRole
      ? 'already_in_role'
      : activeRoleId && hasOtherRole
        ? 'rediscovered_from_other_role'
        : 'known_to_sourcingos',
    employmentObservations: buildEmploymentObservationsV36(input.candidateId, input.profiles),
    trustBoundary: 'Prior role decisions are contextual history only. They never become a global candidate verdict or candidate fact.',
  }
}
