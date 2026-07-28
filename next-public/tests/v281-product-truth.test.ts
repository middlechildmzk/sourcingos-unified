import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  classifyRealSourceResults,
  resolveStoredEntityKind,
} from '../lib/entity-classification'
import type { SourceResult } from '../lib/source-types'

function read(path: string) {
  return readFileSync(join(process.cwd(), path), 'utf8')
}

function result(overrides: Partial<SourceResult> = {}): SourceResult {
  return {
    id: 'github:test-person',
    source: 'github',
    sourceProfileId: 'test-person',
    displayName: 'Test Person',
    skills: [],
    evidence: [],
    contactSignals: [],
    identitySignals: [],
    refreshedAt: new Date(0).toISOString(),
    raw: { type: 'User' },
    ...overrides,
  }
}

describe('V28.1 product truth contracts', () => {
  it('classifies authorized legacy LinkedIn imports as people despite the old resume_xray label', () => {
    expect(resolveStoredEntityKind({
      source: 'resume_xray',
      raw: {
        importType: 'linkedin_connections',
        importSource: 'linkedin_export',
      },
    })).toBe('person')
  })

  it('keeps a real Resume X-Ray record as a search lane', () => {
    expect(resolveStoredEntityKind({
      source: 'resume_xray',
      raw: { mode: 'manual_safe_search' },
    })).toBe('search_lane')
  })

  it('classifies package ecosystems as artifacts and ambiguous DEV accounts as unknown', () => {
    expect(resolveStoredEntityKind({ source: 'pypi' })).toBe('artifact')
    expect(resolveStoredEntityKind({ source: 'npm' })).toBe('artifact')
    expect(resolveStoredEntityKind({ source: 'dockerhub' })).toBe('artifact')
    expect(resolveStoredEntityKind({ source: 'devto' })).toBe('unknown')
  })

  it('uses upstream account type for GitHub and provider type for NPI', () => {
    expect(resolveStoredEntityKind({ source: 'github', raw: { type: 'User' } })).toBe('person')
    expect(resolveStoredEntityKind({ source: 'github', raw: { type: 'Organization' } })).toBe('organization')
    expect(resolveStoredEntityKind({ source: 'npi', raw: { enumeration_type: 'NPI-1', basic: { first_name: 'A' } } })).toBe('person')
    expect(resolveStoredEntityKind({ source: 'npi', raw: { enumeration_type: 'NPI-2', basic: { organization_name: 'Clinic' } } })).toBe('organization')
  })

  it('removes any legacy generated demo result before the API can return it', () => {
    const demo = result({
      id: 'github:demo-github',
      sourceProfileId: 'demo-github',
      headline: 'Demo github source profile.',
      evidence: [{
        id: 'demo-evidence',
        label: 'Demo fallback result',
        detail: 'Generated fallback evidence.',
        source: 'github',
        confidence: 'low',
        observedAt: new Date(0).toISOString(),
      }],
    })
    const real = result()
    expect(classifyRealSourceResults([demo, real])).toEqual([
      expect.objectContaining({ id: real.id, entityKind: 'person' }),
    ])
  })

  it('physically removes the synthetic connector generator and environment flag', () => {
    const connectors = read('lib/source-connectors.ts')
    expect(connectors).not.toContain('function demoResult')
    expect(connectors).not.toContain('maybeDemo')
    expect(connectors).not.toContain('NEXT_PUBLIC_ENABLE_DEMO_SOURCE_RESULTS')
  })

  it('makes save idempotent, person-only, and fail-closed for child writes', () => {
    const route = read('app/api/workbench/save-source-profile/route.ts')
    expect(route).toContain("entityKind !== 'person'")
    expect(route).toContain('{ status: 422 }')
    expect(route).toContain(".eq('source_profile_id', normalizedResult.sourceProfileId)")
    expect(route).toContain(".is('candidate_id', null)")
    expect(route).toContain('source_profiles reconcile')
    expect(route).toContain('evidence write')
    expect(route).toContain('contact write')
    expect(route).toContain('project candidate write')
  })

  it('isolates consecutive search runs and cancels stale source requests', () => {
    const workbench = read('components/WorkbenchClient.tsx')
    const timeout = read('lib/search/source-timeout.ts')
    expect(workbench).toContain('activeRunRef.current?.controller.abort()')
    expect(workbench).toContain('const isCurrent = () =>')
    expect(workbench).toContain('if (cancelled || !isCurrent()) return')
    expect(timeout).toContain('parentSignal?: AbortSignal')
    expect(timeout).toContain('cancelled: boolean')
  })

  it('uses semantic candidate rows and accessible modal behavior', () => {
    const searchResults = read('components/WorkbenchResults.tsx')
    const database = read('components/CandidateDbClient.tsx')
    const drawer = read('components/CandidateDrawer.tsx')
    expect(searchResults).not.toContain('role="button"')
    expect(database).not.toContain('role="button"')
    expect(database).not.toContain('useRouter')
    expect(database).toContain('candidate-row-open-surface')
    expect(drawer).toContain('aria-modal="true"')
    expect(drawer).toContain("event.key === 'Escape'")
    expect(drawer).toContain('previousFocusRef.current?.focus()')
    expect(drawer).toContain('if (!result || !open) return null')
  })

  it('has one Today route and no Agent OS navigation item', () => {
    const page = read('app/app/agent-os/page.tsx')
    const shell = read('components/AppShell.tsx')
    expect(page).toContain("permanentRedirect('/app/today/')")
    expect(shell).not.toContain("label: 'Agent OS'")
    expect(shell).toContain("label: 'Today'")
  })
})
