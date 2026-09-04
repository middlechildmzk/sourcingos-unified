import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const root = path.resolve(process.cwd())
const read = (relative: string) => fs.readFileSync(path.join(root, relative), 'utf8')

const route = read('app/api/fleet/status/route.ts')
const dashboard = read('components/FleetGrowthDashboardClient.tsx')

 describe('V40.3 fleet growth dashboard', () => {
  it('keeps every production metric owner-scoped', () => {
    expect(route).toContain('requireSession')
    expect(route).toContain(".eq('owner_id', gate.userId)")
    expect(route).not.toContain('owner_id: gate.userId')
  })

  it('surfaces graph growth, source yield, scheduler health, and review pressure', () => {
    expect(route).toContain('candidates24h')
    expect(route).toContain('rawDiscoveries24h')
    expect(route).toContain('pendingIdentityReviews')
    expect(route).toContain('count_persisted')
    expect(route).toContain('credits_spent')
    expect(dashboard).toContain('24/7 sourcing operations')
    expect(dashboard).toContain('Scout performance')
    expect(dashboard).toContain('Identity review')
  })

  it('states the autonomous trust boundary instead of implying autonomous hiring authority', () => {
    expect(route).toContain('identityMergeAuthorized: false')
    expect(route).toContain('contactValuesCaptured: false')
    expect(route).toContain('recruiterDecisionAutomated: false')
    expect(dashboard).toContain('cannot reveal contacts')
    expect(dashboard).toContain('silently merge people')
  })
})
