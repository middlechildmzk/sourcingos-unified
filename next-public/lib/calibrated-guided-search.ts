import type { CalibrationInsight, CalibrationState } from './calibration-intelligence'
import { activeInsights } from './calibration-intelligence'
import type { Lane, LaneResult } from './jd-boolean-lanes'
import type { RoleIntake } from './role-workspace'

export type GuidedSearchChangeKind = 'require_signal' | 'exclude_signal' | 'target_companies' | 'review_only'

export type GuidedSearchChange = {
  insightId: string
  subject: string
  kind: GuidedSearchChangeKind
  explanation: string
  applied: boolean
}

export type CalibratedGuidedSearchPlan = {
  revision: number
  calibrated: boolean
  activeInsightIds: string[]
  baseline: LaneResult
  current: LaneResult
  changes: GuidedSearchChange[]
}

const PLAN_ALTERING_EVENTS = new Set([
  'insight_approved',
  'insight_edited',
  'insight_rejected',
  'insight_paused',
  'insight_rolled_back',
])

function cleanTerm(value: string): string {
  return value
    .replace(/["“”]/g, '')
    .replace(/[^a-zA-Z0-9+#./& -]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 90)
}

function quote(value: string): string {
  const clean = cleanTerm(value)
  if (!clean) return ''
  return /\s|\//.test(clean) ? `"${clean}"` : clean
}

function containsTerm(query: string, term: string): boolean {
  const normalizedQuery = query.toLowerCase().replace(/["()]/g, ' ')
  const normalizedTerm = cleanTerm(term).toLowerCase()
  return !!normalizedTerm && normalizedQuery.includes(normalizedTerm)
}

function addRequired(query: string, term: string): string {
  const formatted = quote(term)
  if (!formatted || containsTerm(query, term)) return query
  return query ? `(${query}) AND ${formatted}` : formatted
}

function addExcluded(query: string, term: string, googleStyle = false): string {
  const formatted = quote(term)
  if (!formatted || containsTerm(query, `NOT ${term}`) || query.toLowerCase().includes(`-${formatted.toLowerCase()}`)) return query
  if (googleStyle) return `${query} -${formatted}`.trim()
  return query ? `(${query}) AND NOT (${formatted})` : `NOT (${formatted})`
}

function addCompanyGroup(query: string, companies: string[], googleStyle = false): string {
  const clean = companies.map(cleanTerm).filter(Boolean).slice(0, 8)
  if (!clean.length) return query
  const missing = clean.filter(company => !containsTerm(query, company))
  if (!missing.length) return query
  const group = missing.map(quote).join(' OR ')
  const formatted = missing.length > 1 ? `(${group})` : group
  if (googleStyle) return `${query} ${formatted}`.trim()
  return query ? `(${query}) AND ${formatted}` : formatted
}

function safelySearchableExclusion(subject: string): boolean {
  const clean = cleanTerm(subject).toLowerCase()
  if (!clean || clean.length > 60) return false
  if (/^(no |not |missing |lack |lacks |without |unknown |unverified |unclear )/.test(clean)) return false
  if (/clearance|citizen|citizenship|age|gender|race|religion|disability|veteran status/.test(clean)) return false
  return true
}

function cloneLane(lane: Lane): Lane {
  return {
    ...lane,
    included: [...lane.included],
    removed: [...lane.removed],
    verify: [...lane.verify],
  }
}

function addNote(values: string[], note: string): string[] {
  return values.includes(note) ? values : [...values, note]
}

function applyInsightToLanes(
  lanes: Lane[],
  insight: CalibrationInsight,
  intake: RoleIntake,
): { lanes: Lane[]; change: GuidedSearchChange } {
  const subject = cleanTerm(insight.subject)
  if (!subject || insight.evidenceClass === 'evidence_hygiene') {
    return {
      lanes,
      change: {
        insightId: insight.id,
        subject: subject || insight.subject,
        kind: 'review_only',
        explanation: 'This approved calibration is evidence-review guidance and does not safely translate into a search-string change.',
        applied: false,
      },
    }
  }

  if (insight.evidenceClass === 'disqualifier_pattern') {
    if (!safelySearchableExclusion(subject)) {
      return {
        lanes,
        change: {
          insightId: insight.id,
          subject,
          kind: 'review_only',
          explanation: `The approved disqualifier “${subject}” stays review guidance because SourcingOS cannot safely convert it into an automatic search exclusion.`,
          applied: false,
        },
      }
    }
    let changed = false
    const next = lanes.map(lane => {
      const updated = cloneLane(lane)
      const before = `${updated.boolean}\n${updated.linkedin}\n${updated.googleXray}\n${updated.bingXray}`
      updated.boolean = addExcluded(updated.boolean, subject)
      updated.linkedin = addExcluded(updated.linkedin, subject)
      updated.googleXray = addExcluded(updated.googleXray, subject, true)
      updated.bingXray = addExcluded(updated.bingXray, subject, true)
      updated.removed = addNote(updated.removed, `Approved calibration exclusion: ${subject}`)
      changed = changed || before !== `${updated.boolean}\n${updated.linkedin}\n${updated.googleXray}\n${updated.bingXray}`
      return updated
    })
    return {
      lanes: next,
      change: {
        insightId: insight.id,
        subject,
        kind: 'exclude_signal',
        explanation: `Excluded “${subject}” from recruiter-run guided searches because the recruiter approved this repeated disqualifier pattern.`,
        applied: changed,
      },
    }
  }

  if (insight.evidenceClass === 'company_signal') {
    if (!intake.targetCompanies.length) {
      return {
        lanes,
        change: {
          insightId: insight.id,
          subject,
          kind: 'review_only',
          explanation: 'Target-company learning is approved, but the role has no explicit target-company list to add to search strings.',
          applied: false,
        },
      }
    }
    let changed = false
    const next = lanes.map(lane => {
      const updated = cloneLane(lane)
      const before = `${updated.boolean}\n${updated.linkedin}\n${updated.googleXray}\n${updated.bingXray}`
      updated.boolean = addCompanyGroup(updated.boolean, intake.targetCompanies)
      updated.linkedin = addCompanyGroup(updated.linkedin, intake.targetCompanies)
      updated.googleXray = addCompanyGroup(updated.googleXray, intake.targetCompanies, true)
      updated.bingXray = addCompanyGroup(updated.bingXray, intake.targetCompanies, true)
      updated.included = addNote(updated.included, 'Approved calibration: target companies')
      changed = changed || before !== `${updated.boolean}\n${updated.linkedin}\n${updated.googleXray}\n${updated.bingXray}`
      return updated
    })
    return {
      lanes: next,
      change: {
        insightId: insight.id,
        subject,
        kind: 'target_companies',
        explanation: `Added the recruiter-approved target-company set (${intake.targetCompanies.slice(0, 5).join(', ')}) to guided searches.`,
        applied: changed,
      },
    }
  }

  if (insight.evidenceClass === 'decision_pattern') {
    let changed = false
    const next = lanes.map(lane => {
      const updated = cloneLane(lane)
      const before = `${updated.boolean}\n${updated.linkedin}\n${updated.googleXray}\n${updated.bingXray}`
      updated.boolean = addRequired(updated.boolean, subject)
      updated.linkedin = addRequired(updated.linkedin, subject)
      updated.googleXray = addRequired(updated.googleXray, subject)
      updated.bingXray = addRequired(updated.bingXray, subject)
      updated.included = addNote(updated.included, `Approved calibration emphasis: ${subject}`)
      changed = changed || before !== `${updated.boolean}\n${updated.linkedin}\n${updated.googleXray}\n${updated.bingXray}`
      return updated
    })
    return {
      lanes: next,
      change: {
        insightId: insight.id,
        subject,
        kind: 'require_signal',
        explanation: changed
          ? `Required “${subject}” in guided searches because the recruiter approved it as a repeated strong-fit signal.`
          : `“${subject}” was already required by the current role search, so approval did not add a duplicate term.`,
        applied: changed,
      },
    }
  }

  return {
    lanes,
    change: {
      insightId: insight.id,
      subject,
      kind: 'review_only',
      explanation: `The approved ${insight.evidenceClass.replaceAll('_', ' ')} insight remains visible guidance; SourcingOS does not automatically rewrite guided queries from this pattern.`,
      applied: false,
    },
  }
}

function planRevision(state: CalibrationState | undefined): number {
  if (!state) return 1
  return 1 + state.events.filter(event => PLAN_ALTERING_EVENTS.has(event.type)).length
}

export function buildCalibratedGuidedSearchPlan(
  baseline: LaneResult,
  intake: RoleIntake,
  state: CalibrationState | undefined,
): CalibratedGuidedSearchPlan {
  const approved = activeInsights(state)
  let lanes = baseline.lanes.map(cloneLane)
  const changes: GuidedSearchChange[] = []

  for (const insight of approved) {
    const applied = applyInsightToLanes(lanes, insight, intake)
    lanes = applied.lanes
    changes.push(applied.change)
  }

  return {
    revision: planRevision(state),
    calibrated: approved.length > 0,
    activeInsightIds: approved.map(insight => insight.id),
    baseline,
    current: { ...baseline, lanes },
    changes,
  }
}
