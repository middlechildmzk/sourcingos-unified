import type { CalibrationState } from './calibration-intelligence'
import {
  buildAgenticSearchPlan,
  type AgenticLaneId,
  type AgenticSearchPlan,
  type AgenticSearchSurface,
} from './agentic-search-v30'
import { buildDomainPackProfile, type DomainPackMatch } from './domain-packs-v31'
import { enrichRoleIntakeWithOnet, type RoleIntelligenceContext } from './onet-role-intelligence'
import type { RoleIntake } from './role-workspace'

const PUBLIC_SURFACES = new Set<AgenticSearchSurface>(['github', 'research_publications', 'google_xray'])
const DOMAIN_EXECUTABLE_SURFACES = new Set<AgenticSearchSurface>(['github', 'research_publications'])
const SENSITIVE = /\b(?:ts\/?sci|top secret|secret|public trust|polygraph|clearance|citizenship|citizen)\b/i

export type CanonicalAgenticSearchPlan = AgenticSearchPlan & {
  domainPacks: DomainPackMatch[]
  roleIntelligence: {
    onetConfigured: boolean
    onetOccupation?: { code: string; title: string }
    onetAttribution?: string
  }
}

function clean(value: string): string {
  return value.replace(/["“”]/g, '').replace(/[^a-zA-Z0-9+#./& -]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 90)
}

function uniq(values: string[], max = 10): string[] {
  return Array.from(new Set(values.map(clean).filter(Boolean))).slice(0, max)
}

function quote(value: string): string {
  const term = clean(value)
  return /\s|\//.test(term) ? `"${term}"` : term
}

function or(values: string[], max = 8): string {
  const terms = uniq(values, max).map(quote)
  if (!terms.length) return ''
  return terms.length === 1 ? terms[0] : `(${terms.join(' OR ')})`
}

function and(values: string[]): string {
  return values.map(value => value.trim()).filter(Boolean).join(' AND ')
}

function publicTerms(values: string[]): string[] {
  return values.map(clean).filter(term => term && !SENSITIVE.test(term))
}

export function publicQueryForAgenticLane(intake: RoleIntake, laneId: AgenticLaneId): string {
  const title = SENSITIVE.test(intake.title) ? clean(intake.title).replace(/\b(?:ts\/?sci|top secret|secret|public trust|polygraph|clearance)\b/ig, '').trim() : clean(intake.title)
  const must = publicTerms(intake.mustHaves)
  const nice = publicTerms(intake.niceToHaves)
  const adjacent = publicTerms(intake.adjacentBackgrounds)
  const targets = uniq(intake.targetCompanies, 6)

  const fallback = and([title ? quote(title) : '', or(must.slice(0, 5))]) || or([...must, ...nice].slice(0, 6))
  switch (laneId) {
    case 'exact_title':
      return and([title ? quote(title) : '', or(must.slice(0, 4))]) || fallback
    case 'adjacent_title':
      return and([or([title, ...adjacent.slice(0, 5)]), or([...must.slice(0, 3), ...nice.slice(0, 2)])]) || fallback
    case 'skill_cluster':
      return and([or(must.slice(0, 6)), nice.length ? or(nice.slice(0, 3)) : '']) || fallback
    case 'evidence_first':
      return and([or([...must.slice(0, 4), ...nice.slice(0, 3)]), title ? quote(title) : '']) || fallback
    case 'target_company':
      return and([or(targets), or([title, ...adjacent.slice(0, 3)]), or(must.slice(0, 3))]) || fallback
    case 'clearance_first':
      // Clearance may be a legitimate recruiter-run discovery breadcrumb, but it
      // is deliberately excluded from open/public executable connector queries.
      return and([or(must.slice(0, 4)), or([title, ...adjacent.slice(0, 2)])]) || fallback
  }
}

/**
 * The canonical planner is the one recruiter-facing search plan. Domain packs
 * filter executable public surfaces and O*NET can enrich adjacent-title/search
 * language without rewriting recruiter-approved must-have requirements.
 */
export function buildCanonicalAgenticSearchPlan(
  intake: RoleIntake,
  state?: CalibrationState,
  context: RoleIntelligenceContext = {},
): CanonicalAgenticSearchPlan {
  const enrichedIntake = enrichRoleIntakeWithOnet(intake, context.onet)
  const domainProfile = buildDomainPackProfile(enrichedIntake)
  const base = buildAgenticSearchPlan(enrichedIntake, state)

  return {
    ...base,
    lanes: base.lanes.map(lane => {
      const publicQuery = publicQueryForAgenticLane(enrichedIntake, lane.id)
      return {
        ...lane,
        tasks: lane.tasks
          .map(task => PUBLIC_SURFACES.has(task.surface) ? { ...task, query: publicQuery } : task)
          .filter(task => !DOMAIN_EXECUTABLE_SURFACES.has(task.surface) || domainProfile.executablePublicSurfaces.has(task.surface)),
      }
    }),
    domainPacks: domainProfile.matches,
    roleIntelligence: {
      onetConfigured: Boolean(context.onet?.configured),
      ...(context.onet?.matchedOccupation ? { onetOccupation: context.onet.matchedOccupation } : {}),
      ...(context.onet?.attribution ? { onetAttribution: context.onet.attribution } : {}),
    },
  }
}

export function executableTaskDistinctness(plan: AgenticSearchPlan): { taskCount: number; distinctCount: number } {
  const fingerprints = plan.lanes.flatMap(lane => lane.tasks
    .filter(task => task.mode === 'executable' && task.surface !== 'candidate_database')
    .map(task => `${task.surface}:${task.query.toLowerCase().replace(/[()"']/g, ' ').replace(/\s+/g, ' ').trim()}`))
  return { taskCount: fingerprints.length, distinctCount: new Set(fingerprints).size }
}
