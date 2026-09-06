import { describe, expect, it } from 'vitest'
import {
  mobileSearchPaneV41,
  preserveSelectionV41,
  resolveSearchWorkspacePhaseV41,
  searchColumnTemplateV41,
  searchWorkspaceLayoutV41,
} from '@/lib/search/workspace-layout-v41'

describe('V41 search workspace phase', () => {
  it('starts in composing with nothing run yet', () => {
    expect(resolveSearchWorkspacePhaseV41({})).toBe('composing')
  })

  it('is searching while planning or executing providers', () => {
    expect(resolveSearchWorkspacePhaseV41({ working: 'planning' })).toBe('searching')
    expect(resolveSearchWorkspacePhaseV41({ working: 'searching' })).toBe('searching')
    expect(resolveSearchWorkspacePhaseV41({ working: 'web' })).toBe('searching')
  })

  it('is reviewing once results exist', () => {
    expect(resolveSearchWorkspacePhaseV41({ hasResult: true })).toBe('reviewing')
    expect(resolveSearchWorkspacePhaseV41({ hasWeb: true })).toBe('reviewing')
  })

  // Contact lookup and save are actions taken from inside a review pass. If they
  // reset the phase, the slate collapses under the recruiter mid-decision.
  it('stays in reviewing during candidate-level actions', () => {
    expect(resolveSearchWorkspacePhaseV41({ working: 'contacts', hasResult: true })).toBe('reviewing')
    expect(resolveSearchWorkspacePhaseV41({ working: 'saving', hasResult: true })).toBe('reviewing')
  })
})

describe('V41 search workspace columns', () => {
  it('gives the brief real estate before a search runs', () => {
    const layout = searchWorkspaceLayoutV41({ phase: 'composing' })
    expect(layout.columns.rail).toBeGreaterThanOrEqual(30)
    expect(layout.columns.detail).toBe(0)
  })

  // The core IA change: Candidate 360 was previously the narrowest column on
  // screen at a fixed 300-360px. In review it must be the dominant pane.
  it('makes Candidate 360 the largest pane while reviewing a selection', () => {
    const layout = searchWorkspaceLayoutV41({ phase: 'reviewing', hasSelection: true })
    expect(layout.columns.detail).toBeGreaterThan(layout.columns.list)
    expect(layout.columns.detail).toBeGreaterThan(layout.columns.rail)
  })

  it('hits the specified desktop review band', () => {
    const { columns } = searchWorkspaceLayoutV41({ phase: 'reviewing', hasSelection: true })
    expect(columns.rail).toBeGreaterThanOrEqual(18)
    expect(columns.rail).toBeLessThanOrEqual(24)
    expect(columns.list).toBeGreaterThanOrEqual(30)
    expect(columns.list).toBeLessThanOrEqual(34)
    expect(columns.detail).toBeGreaterThanOrEqual(46)
    expect(columns.detail).toBeLessThanOrEqual(52)
  })

  it('always totals 100 across every phase and rail state', () => {
    for (const phase of ['composing', 'searching', 'reviewing'] as const) {
      for (const railCollapsed of [false, true]) {
        const { columns } = searchWorkspaceLayoutV41({ phase, railCollapsed, hasSelection: true })
        expect(columns.rail + columns.list + columns.detail).toBe(100)
      }
    }
  })

  it('returns the detail share to the slate when no candidate is open', () => {
    const layout = searchWorkspaceLayoutV41({ phase: 'reviewing', hasSelection: false })
    expect(layout.detailVisible).toBe(false)
    expect(layout.columns.detail).toBe(0)
    expect(layout.columns.rail + layout.columns.list).toBe(100)
  })

  it('collapses the rail to 38/62 list-detail on narrow desktop', () => {
    const { columns } = searchWorkspaceLayoutV41({ phase: 'reviewing', hasSelection: true, breakpoint: 'narrow' })
    expect(columns).toEqual({ rail: 0, list: 38, detail: 62 })
  })

  it('gives the slate and dossier more room when the rail is collapsed', () => {
    const expanded = searchWorkspaceLayoutV41({ phase: 'reviewing', hasSelection: true })
    const collapsed = searchWorkspaceLayoutV41({ phase: 'reviewing', hasSelection: true, railCollapsed: true })
    expect(collapsed.rail).toBe('collapsed')
    expect(collapsed.columns.rail).toBeLessThan(expanded.columns.rail)
    expect(collapsed.columns.detail).toBeGreaterThan(expanded.columns.detail)
  })

  it('emits a grid template that omits zero-width columns', () => {
    expect(searchColumnTemplateV41({ rail: 21, list: 32, detail: 47 })).toBe('21fr 32fr 47fr')
    expect(searchColumnTemplateV41({ rail: 34, list: 66, detail: 0 })).toBe('34fr 66fr')
  })
})

describe('V41 agent activity progressive disclosure', () => {
  it('is prominent while the agent is actually working', () => {
    expect(searchWorkspaceLayoutV41({ phase: 'composing' }).agentActivity).toBe('prominent')
    expect(searchWorkspaceLayoutV41({ phase: 'searching' }).agentActivity).toBe('prominent')
  })

  // Provider plumbing must not sit between the recruiter and the slate once
  // there are candidates to review.
  it('compresses to a strip once results are on screen', () => {
    expect(searchWorkspaceLayoutV41({ phase: 'reviewing', hasSelection: true }).agentActivity).toBe('strip')
    expect(searchWorkspaceLayoutV41({ phase: 'reviewing', hasSelection: false }).agentActivity).toBe('strip')
  })
})

describe('V41 mobile panes', () => {
  it('opens on the brief before a search', () => {
    expect(mobileSearchPaneV41({ phase: 'composing' })).toBe('brief')
  })

  it('shows results during and after a run with nothing selected', () => {
    expect(mobileSearchPaneV41({ phase: 'searching' })).toBe('results')
    expect(mobileSearchPaneV41({ phase: 'reviewing' })).toBe('results')
  })

  it('switches to detail when a candidate is open', () => {
    expect(mobileSearchPaneV41({ phase: 'reviewing', hasSelection: true })).toBe('detail')
  })

  it('honours an explicitly opened brief over the derived pane', () => {
    expect(mobileSearchPaneV41({ phase: 'reviewing', hasSelection: true, briefOpen: true })).toBe('brief')
  })
})

describe('V41 selection preservation', () => {
  it('keeps the recruiter on the same candidate across a refine', () => {
    expect(preserveSelectionV41({ selectedKey: 'b', nextKeys: ['a', 'b', 'c'] })).toBe(1)
  })

  it('follows the candidate when the slate reorders', () => {
    expect(preserveSelectionV41({ selectedKey: 'b', nextKeys: ['c', 'b', 'a'] })).toBe(1)
  })

  // A dossier must never stay open for someone who is not in the current
  // result set; that would show evidence detached from the search.
  it('clears the selection when the candidate is no longer returned', () => {
    expect(preserveSelectionV41({ selectedKey: 'z', nextKeys: ['a', 'b'] })).toBeNull()
  })

  it('handles no prior selection', () => {
    expect(preserveSelectionV41({ selectedKey: null, nextKeys: ['a'] })).toBeNull()
  })
})
