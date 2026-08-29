import type { CalibrationState } from './calibration-intelligence'
import { activeInsights } from './calibration-intelligence'
import type { RoleIntake } from './role-workspace'
import type { ConnectorKey } from './acquisition-v22'

export type AgenticLaneId =
  | 'exact_title'
  | 'adjacent_title'
  | 'skill_cluster'
  | 'evidence_first'
  | 'target_company'
  | 'clearance_first'

export type SearchExecutionMode = 'executable' | 'guided' | 'provider_optional' | 'unavailable'

export type AgenticSearchSurface =
  | 'candidate_database'
  | 'github'
  | 'research_publications'
  | 'linkedin_recruiter'
  | 'clearancejobs'
  | 'google_xray'
  | 'exa_people'
  | 'coresignal_people'
  | 'pdl_people'

export type AgenticSourceTask = {
  surface: AgenticSearchSurface
  label: string
  mode: SearchExecutionMode
  query: string
  connectorKeys?: ConnectorKey[]
  truth: string
}

export type AgenticSearchLane = {
  id: AgenticLaneId
  label: string
  hypothesis: string
  blindSpot: string
  query: string
  priority: number
  tasks: AgenticSourceTask[]
}

export type AgenticSearchPlan = {
  revision: number
  lanes: AgenticSearchLane[]
  distinctQueryCount: number
  integrityWarnings: string[]
  approvedLearningCount: number
}

const TECHNICAL = /engineer|developer|architect|devops|devsecops|cloud|security|cyber|data|software|platform|infrastructure|sre|machine learning|\bai\b/i
const RESEARCH = /research|scientist|clinical|medical|health|physician|nurse|biotech|pharma|publication|academic/i

function clean(value: string): string {
  return value.replace(/["“”]/g, '').replace(/[^a-zA-Z0-9+#./& -]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 90)
}

function uniq(values: string[], max = 12): string[] {
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

function safeExclusion(value: string): boolean {
  const term = clean(value).toLowerCase()
  if (!term || term.length > 60) return false
  if (/^(no |not |missing |lack |lacks |without |unknown |unverified |unclear )/.test(term)) return false
  if (/clearance|citizen|citizenship|age|gender|race|religion|disability|veteran status/.test(term)) return false
  return true
}

function calibrationDirectives(intake: RoleIntake, state?: CalibrationState) {
  const insights = activeInsights(state)
  const required = uniq(insights.filter(item => item.evidenceClass === 'decision_pattern').map(item => item.subject), 6)
  const excluded = uniq(insights.filter(item => item.evidenceClass === 'disqualifier_pattern' && safeExclusion(item.subject)).map(item => item.subject), 6)
  const useTargets = insights.some(item => item.evidenceClass === 'company_signal')
  return {
    required,
    excluded,
    targetCompanies: useTargets ? intake.targetCompanies : [],
    count: insights.length,
  }
}

function appendDirectives(query: string, directives: ReturnType<typeof calibrationDirectives>): string {
  let next = query
  if (directives.required.length) next = and([next, ...directives.required.map(quote)])
  if (directives.targetCompanies.length) next = and([next, or(directives.targetCompanies)])
  if (directives.excluded.length) next = and([next, `NOT (${directives.excluded.map(quote).join(' OR ')})`])
  return next
}

function revision(state?: CalibrationState): number {
  if (!state) return 1
  const altering = new Set(['insight_approved', 'insight_edited', 'insight_rejected', 'insight_paused', 'insight_rolled_back'])
  return 1 + state.events.filter(event => altering.has(event.type)).length
}

function sourceTasks(query: string, intake: RoleIntake, lane: AgenticLaneId): AgenticSourceTask[] {
  const technical = TECHNICAL.test(`${intake.title} ${intake.mustHaves.join(' ')} ${intake.niceToHaves.join(' ')}`)
  const research = RESEARCH.test(`${intake.title} ${intake.mustHaves.join(' ')} ${intake.niceToHaves.join(' ')}`)
  const tasks: AgenticSourceTask[] = [
    {
      surface: 'candidate_database',
      label: 'SourcingOS Talent',
      mode: 'executable',
      query,
      truth: 'Searches the recruiter-owned Candidate Graph through the existing supported search surface.',
    },
    {
      surface: 'linkedin_recruiter',
      label: 'LinkedIn Recruiter',
      mode: 'guided',
      query,
      truth: 'SourcingOS prepares the strategy; the recruiter runs the search in their authorized LinkedIn Recruiter account.',
    },
    {
      surface: 'clearancejobs',
      label: 'ClearanceJobs / ATS',
      mode: 'guided',
      query,
      truth: 'SourcingOS prepares the query only. Clearance or suitability language remains candidate-stated or unverified until confirmed through the proper process.',
    },
    {
      surface: 'google_xray',
      label: 'Google X-Ray',
      mode: 'guided',
      query,
      truth: 'Open-web query prepared for recruiter review. Search-result context is not candidate evidence.',
    },
    {
      surface: 'exa_people',
      label: 'Exa People',
      mode: 'provider_optional',
      query,
      truth: 'Provider adapter is intentionally optional until licensed use, cost, and evaluation gates are approved.',
    },
    {
      surface: 'coresignal_people',
      label: 'Coresignal',
      mode: 'provider_optional',
      query,
      truth: 'Provider adapter is intentionally optional until licensed use, cost, and evaluation gates are approved.',
    },
    {
      surface: 'pdl_people',
      label: 'People Data Labs',
      mode: 'provider_optional',
      query,
      truth: 'Provider adapter is intentionally optional until licensed use, cost, and evaluation gates are approved.',
    },
  ]

  if (technical || lane === 'evidence_first') {
    tasks.splice(1, 0, {
      surface: 'github',
      label: 'GitHub public profiles',
      mode: 'executable',
      query,
      connectorKeys: ['github'],
      truth: 'Runs the existing official GitHub API connector. Public work is evidence; identity linking still requires review.',
    })
  }
  if (research || lane === 'evidence_first') {
    tasks.splice(technical || lane === 'evidence_first' ? 2 : 1, 0, {
      surface: 'research_publications',
      label: 'Public research graph',
      mode: 'executable',
      query,
      connectorKeys: ['orcid', 'openalex', 'pubmed', 'crossref'],
      truth: 'Runs existing public scholarly connectors. Publication authorship is evidence, not proof of current employment or fit.',
    })
  }
  return tasks
}

function lane(
  id: AgenticLaneId,
  label: string,
  hypothesis: string,
  blindSpot: string,
  query: string,
  priority: number,
  intake: RoleIntake,
): AgenticSearchLane {
  return { id, label, hypothesis, blindSpot, query, priority, tasks: sourceTasks(query, intake, id) }
}

function fingerprint(query: string): string {
  return query.toLowerCase().replace(/[()"']/g, ' ').replace(/\s+/g, ' ').trim()
}

export function buildAgenticSearchPlan(intake: RoleIntake, state?: CalibrationState): AgenticSearchPlan {
  const title = clean(intake.title)
  const must = uniq(intake.mustHaves, 8)
  const nice = uniq(intake.niceToHaves, 6)
  const adjacent = uniq(intake.adjacentBackgrounds, 8)
  const targets = uniq(intake.targetCompanies, 8)
  const clearance = intake.clearance && intake.clearance !== 'Not specified' ? clean(intake.clearance) : ''
  const location = intake.location && intake.location !== 'Not specified' ? clean(intake.location) : ''
  const directives = calibrationDirectives(intake, state)

  const exact = appendDirectives(and([quote(title), or(must.slice(0, 4)), location ? quote(location) : '']), directives)
  const adjacentQuery = appendDirectives(and([or([title, ...adjacent.slice(0, 5)]), or([...must.slice(0, 3), ...nice.slice(0, 2)])]), directives)
  const skillQuery = appendDirectives(and([or(must.slice(0, 6)), nice.length ? or(nice.slice(0, 3)) : '']), directives)
  const evidenceQuery = appendDirectives(and([or([...must.slice(0, 4), ...nice.slice(0, 3)]), title ? quote(title) : '']), directives)

  const lanes: AgenticSearchLane[] = [
    lane('exact_title', 'Exact title / incumbent', 'Start with the closest observable title-and-skill match to establish precision and a calibration baseline.', 'Misses adjacent titles and candidates whose current title understates the work they actually do.', exact, 1, intake),
    lane('adjacent_title', 'Adjacent title expansion', 'Broaden title language while holding the strongest capability requirements constant.', 'Higher recall can introduce functionally adjacent people the hiring manager will not actually consider.', adjacentQuery, 2, intake),
    lane('skill_cluster', 'Skill-cluster search', 'Find people through capability combinations even when their title is non-standard.', 'Skills named on profiles can be shallow or stale; evidence review matters more than title matching here.', skillQuery, 3, intake),
    lane('evidence_first', 'Public work / evidence first', 'Look for technical, research, publication, or public-work signals that independently support the role requirements.', 'Public work is unevenly distributed and can systematically miss strong candidates with little public footprint.', evidenceQuery, 4, intake),
  ]

  if (targets.length) {
    const targetQuery = appendDirectives(and([or(targets), or([title, ...adjacent.slice(0, 3)]), or(must.slice(0, 3))]), directives)
    lanes.push(lane('target_company', 'Target-company ecosystem', 'Search the explicitly approved company set for incumbents and adjacent talent pools.', 'Company targeting can overfit the search and should not substitute for requirement evidence.', targetQuery, 5, intake))
  }

  if (clearance) {
    const clearanceQuery = appendDirectives(and([quote(clearance), or(must.slice(0, 4)), or([title, ...adjacent.slice(0, 2)])]), directives)
    lanes.push(lane('clearance_first', 'Clearance-first breadcrumbs', 'Use the required clearance language as a discovery breadcrumb while preserving the role capability bar.', 'A public or candidate-stated clearance mention is not verification and must never be represented as verified clearance.', clearanceQuery, 6, intake))
  }

  const fingerprints = lanes.map(item => fingerprint(item.query))
  const distinctQueryCount = new Set(fingerprints).size
  const integrityWarnings: string[] = []
  if (distinctQueryCount !== lanes.length) integrityWarnings.push('Two or more search lanes collapse to the same normalized query. Review the role criteria before execution.')
  if (lanes.length < 4) integrityWarnings.push('The plan has fewer than four strategy lanes and is too narrow for an agentic sourcing pass.')
  if (!must.length) integrityWarnings.push('No must-have capabilities are confirmed, so every lane is operating with a weak requirement model.')

  return {
    revision: revision(state),
    lanes,
    distinctQueryCount,
    integrityWarnings,
    approvedLearningCount: directives.count,
  }
}

export function executableConnectorKeys(lane: AgenticSearchLane): ConnectorKey[] {
  return Array.from(new Set(lane.tasks.flatMap(task => task.mode === 'executable' ? (task.connectorKeys || []) : [])))
}

export function sourceTruthSummary(lane: AgenticSearchLane) {
  return lane.tasks.reduce((summary, task) => {
    summary[task.mode] = (summary[task.mode] || 0) + 1
    return summary
  }, {} as Partial<Record<SearchExecutionMode, number>>)
}
