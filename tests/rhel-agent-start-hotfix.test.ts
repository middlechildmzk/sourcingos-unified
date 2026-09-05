import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { buildCanonicalAgenticSearchPlan } from '@/lib/canonical-agentic-search-v30'
import { buildDomainPackProfile } from '@/lib/domain-packs-v31'
import { interpretRoleBrief } from '@/lib/role-brief-v33'
import type { RoleIntake } from '@/lib/role-workspace'

const here = dirname(fileURLToPath(import.meta.url))

function intake(title: string): RoleIntake {
  return {
    title,
    location: 'Washington DC',
    workMode: 'unknown',
    compensation: 'Not specified',
    clearance: 'Secret',
    mustHaves: [],
    niceToHaves: [],
    disqualifiers: [],
    targetCompanies: [],
    adjacentBackgrounds: [],
    hiringManagerNotes: '',
    rawDescription: `${title} in Washington DC with Secret clearance`,
  }
}

describe('RHEL agent-start hotfix', () => {
  it('accepts a terse role-first request without requiring a title edit', () => {
    const result = interpretRoleBrief('RHEL admin in Washington DC area with 5+ years of Linux experience and a secret clearance or higher')
    expect(result.intake.title).toBe('RHEL admin')
    expect(result.intake.location).toBe('Washington DC')
    expect(result.intake.mustHaves.some(item => /5\+ years.*linux/i.test(item))).toBe(true)
  })

  it.each(['RHEL admin', 'Linux administrator', 'Systems administrator', 'sysadmin'])('classifies %s as technical and keeps executable technical sources', title => {
    const role = intake(title)
    const profile = buildDomainPackProfile(role)
    expect(profile.activeIds.has('technical')).toBe(true)
    expect(profile.executablePublicSurfaces.has('github')).toBe(true)
    expect(profile.executablePublicSurfaces.has('stackoverflow')).toBe(true)

    const plan = buildCanonicalAgenticSearchPlan(role)
    const connectors = plan.lanes.flatMap(lane => lane.tasks.flatMap(task => task.connectorKeys || []))
    expect(connectors).toContain('github')
    expect(connectors).toContain('stackoverflow')
  })

  it('uses distinct capability queries across public-source search angles', () => {
    const plan = buildCanonicalAgenticSearchPlan({
      ...intake('RHEL Administrator'),
      mustHaves: ['5+ years Linux experience'],
      adjacentBackgrounds: ['Linux systems engineer'],
    })
    const publicQueries = plan.lanes.map(lane => lane.tasks.find(task => task.surface === 'github')?.query).filter(Boolean)
    expect(new Set(publicQueries).size).toBeGreaterThan(2)
    expect(publicQueries.join(' ')).toContain('Linux')
    expect(publicQueries.join(' ')).not.toContain('5+ years Linux experience')
  })

  it('does not leave auto-start silently spinning when no executable source or no eligible slate exists', () => {
    const source = readFileSync(join(here, '../components/RoleAutoStartV33_4.tsx'), 'utf8')
    expect(source).toContain('This search has no executable public source yet.')
    expect(source).toContain('Search completed, but this pass returned no eligible public-source records')
    expect(source).toContain('The initial sourcing pass timed out')
  })
})
