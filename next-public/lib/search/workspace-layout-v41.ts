/**
 * V41 PR2 — /app/search information architecture.
 *
 * The search workspace previously rendered one fixed three-column grid for
 * every state of the recruiter's journey. The Candidate 360 pane was pinned at
 * 300-360px, which made the most important surface in the product the smallest
 * column on screen, while Agent Activity sat above the slate at full width even
 * after the run had finished.
 *
 * This module owns the layout decision as data. It is deliberately pure: no
 * React, no DOM, no provider state. The component reads a resolved layout and
 * renders it; the rules stay testable and reviewable in one place.
 *
 * Nothing here touches evidence semantics, provider behaviour, or recruiter
 * decisions. It decides how much room each pane gets, and nothing else.
 */

export type SearchWorkspacePhase = 'composing' | 'searching' | 'reviewing'

export type SearchRailState = 'expanded' | 'collapsed'

export type AgentActivityMode = 'prominent' | 'strip'

export type SearchWorkspaceBreakpoint = 'wide' | 'narrow' | 'mobile'

export type SearchColumnPlan = {
  /** Percentage widths. rail + list + detail === 100 on desktop breakpoints. */
  rail: number
  list: number
  detail: number
}

export type SearchWorkspaceLayout = {
  phase: SearchWorkspacePhase
  rail: SearchRailState
  agentActivity: AgentActivityMode
  columns: SearchColumnPlan
  /** True when the detail pane holds a candidate and should be laid out. */
  detailVisible: boolean
}

export type SearchMobilePane = 'brief' | 'results' | 'detail'

/**
 * Phase is derived, never stored. Storing it would let the UI drift out of sync
 * with what the agent is actually doing — the recruiter would see "reviewing"
 * while a run was still in flight.
 *
 * `contacts` and `saving` are candidate-level actions taken from inside the
 * review pass. They must not knock the workspace back to a searching layout and
 * yank the slate out from under the recruiter mid-decision.
 */
export function resolveSearchWorkspacePhaseV41(input: {
  working?: string
  hasResult?: boolean
  hasWeb?: boolean
}): SearchWorkspacePhase {
  const running = input.working === 'planning' || input.working === 'searching' || input.working === 'web'
  if (running) return 'searching'
  if (input.hasResult || input.hasWeb) return 'reviewing'
  return 'composing'
}

const COLUMNS: Record<SearchWorkspacePhase, { expanded: SearchColumnPlan; collapsed: SearchColumnPlan }> = {
  // Before a search the brief is the product. There is no slate to compete with
  // it and no candidate to inspect, so the composer takes real estate.
  composing: {
    expanded: { rail: 34, list: 66, detail: 0 },
    collapsed: { rail: 6, list: 94, detail: 0 },
  },
  // During the run the brief compacts to make room for streaming progress, but
  // does not disappear: the recruiter is still reading what was interpreted.
  searching: {
    expanded: { rail: 28, list: 72, detail: 0 },
    collapsed: { rail: 6, list: 94, detail: 0 },
  },
  // After candidates arrive the centre of gravity moves right. Targets are the
  // 18-24 / 30-34 / 46-52 band: the dossier becomes the dominant workspace.
  reviewing: {
    expanded: { rail: 21, list: 32, detail: 47 },
    collapsed: { rail: 6, list: 35, detail: 59 },
  },
}

/** Narrow desktop drops the rail entirely and splits list/detail 38/62. */
const NARROW_REVIEWING: SearchColumnPlan = { rail: 0, list: 38, detail: 62 }

export function searchWorkspaceLayoutV41(input: {
  phase: SearchWorkspacePhase
  railCollapsed?: boolean
  hasSelection?: boolean
  breakpoint?: SearchWorkspaceBreakpoint
}): SearchWorkspaceLayout {
  const phase = input.phase
  const breakpoint = input.breakpoint || 'wide'
  const rail: SearchRailState = input.railCollapsed ? 'collapsed' : 'expanded'

  // Agent Activity earns full width only while it is actually reporting live
  // work. Once results are on screen it becomes a progress strip, because a
  // recruiter reviewing candidates should not have to scroll past provider
  // plumbing to reach the slate. Diagnostics stay reachable, not resident.
  const agentActivity: AgentActivityMode = phase === 'reviewing' ? 'strip' : 'prominent'

  const detailVisible = phase === 'reviewing' && Boolean(input.hasSelection)

  let columns = COLUMNS[phase][rail === 'collapsed' ? 'collapsed' : 'expanded']
  if (breakpoint === 'narrow' && phase === 'reviewing') columns = NARROW_REVIEWING

  // With no candidate open, the detail column's share returns to the slate
  // rather than sitting empty. An empty 47% pane reads as a broken screen.
  if (!detailVisible && columns.detail > 0) {
    columns = { rail: columns.rail, list: columns.list + columns.detail, detail: 0 }
  }

  return { phase, rail, agentActivity, columns, detailVisible }
}

/**
 * Mobile is modes, not compressed columns. Three columns at 380px is three
 * unusable columns. The recruiter is in exactly one pane at a time and moves
 * between them explicitly.
 */
export function mobileSearchPaneV41(input: {
  phase: SearchWorkspacePhase
  hasSelection?: boolean
  briefOpen?: boolean
}): SearchMobilePane {
  // An explicitly opened brief wins: the recruiter asked for it. It is a
  // deliberate action, so it is not overridden by an in-flight run.
  if (input.briefOpen) return 'brief'
  if (input.phase === 'reviewing' && input.hasSelection) return 'detail'
  if (input.phase === 'composing') return 'brief'
  return 'results'
}

/**
 * Selection must survive layout transitions. Refining a search does not clear
 * the recruiter's place in the slate, but a candidate that is no longer in the
 * returned set cannot stay open — that would show a dossier detached from the
 * current result. Returns the index to keep, or null.
 */
export function preserveSelectionV41(input: {
  selectedKey?: string | null
  nextKeys: readonly string[]
}): number | null {
  if (!input.selectedKey) return null
  const index = input.nextKeys.indexOf(input.selectedKey)
  return index >= 0 ? index : null
}

export function searchColumnTemplateV41(columns: SearchColumnPlan): string {
  return [columns.rail, columns.list, columns.detail]
    .filter(value => value > 0)
    .map(value => `${value}fr`)
    .join(' ')
}
