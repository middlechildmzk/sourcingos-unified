import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(__dirname, '..')
const detail = fs.readFileSync(path.join(root, 'components/RoleDetailClient.tsx'), 'utf8')
const panel = fs.readFileSync(path.join(root, 'components/RoleCalibrationPanel.tsx'), 'utf8')

describe('V27 role calibration surface', () => {
  it('adds a calibration tab with a pending-review badge', () => {
    expect(detail).toContain("'overview', 'candidates', 'calibration', 'strategy', 'activity'")
    expect(detail).toContain('pendingCalibration')
    expect(detail).toContain('RoleCalibrationPanel')
  })

  it('gives every insight the full recruiter control set', () => {
    for (const control of ["'approve'", "'edit'", "'reject'", "'pause'", "'set_scope'", "'rollback'"]) {
      expect(panel).toContain(control)
    }
    expect(panel).toContain('Save as org preference')
    expect(panel).toContain('View evidence')
    expect(panel).toContain('Roll back')
  })

  it('states honestly that patterns are not verified facts and nothing applies silently', () => {
    expect(panel).toContain('not verified facts')
    expect(panel).toContain('until you approve')
    expect(panel).toContain('Nothing is learned silently')
  })

  it('shows before-and-after ranking explanation and lane recommendations without auto-applying', () => {
    expect(panel).toContain('How approved learning changes this search')
    expect(panel).toContain('rankCandidatesWithCalibration')
    expect(panel).toContain('recommendLaneChanges')
    expect(panel).toContain('Review in strategy')
    expect(panel).not.toContain('lane.status =')
  })

  it('keeps uncertain evidence visible instead of resolving it through learning', () => {
    expect(panel).toContain('Still uncertain')
    expect(panel).toContain('Learning does not resolve evidence')
  })

  it('uses accessible controls with labels', () => {
    expect(panel.match(/aria-label=/g)!.length).toBeGreaterThanOrEqual(4)
    expect(panel).toContain('aria-expanded')
    expect(panel).toContain('role="status"')
  })
})
