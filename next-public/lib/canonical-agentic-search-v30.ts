import type { CalibrationState } from './calibration-intelligence'
import {
  buildAgenticSearchPlan,
  type AgenticLaneId,
  type AgenticSearchPlan,
  type AgenticSearchSurface,
} from './agentic-search-v30'
import type { RoleIntake } from './role-workspace'

const PUBLIC_SURFACES = new Set<AgenticSearchSurface>(['github', 'research_publications', 'google_xray'])
const SENSITIVE = /\b(?:ts\/?sci|top secret|secret|public trust|polygraph|clearance|citizenship|citizen)\b/i

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

export function buildCanonicalAgenticSearchPlan(intake: RoleIntake, state?: CalibrationState): AgenticSearchPlan {
  const base = buildAgenticSearchPlan(intake, state)
  return {
    ...base,
    lanes: base.lanes.map(lane => {
      const publicQuery = publicQueryForAgenticLane(intake, lane.id)
      return {
        ...lane,
        tasks: lane.tasks.map(task => PUBLIC_SURFACES.has(task.surface) ? { ...task, query: publicQuery } : task),
      }
    }),
  }
}

export function executableTaskDistinctness(plan: AgenticSearchPlan): { taskCount: number; distinctCount: number } {
  const fingerprints = plan.lanes.flatMap(lane => lane.tasks
    .filter(task => task.mode === 'executable' && task.surface !== 'candidate_database')
    .map(task => `${task.surface}:${task.query.toLowerCase().replace(/[()"']/g, ' ').replace(/\s+/g, ' ').trim()}`))
  return { taskCount: fingerprints.length, distinctCount: new Set(fingerprints).size }
}
