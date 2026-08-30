import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { buildCanonicalAgenticSearchPlan } from '../lib/canonical-agentic-search-v30'
import { interpretRoleBrief } from '../lib/role-brief-v33'
import { buildSearchLanes, parseRoleIntake } from '../lib/role-workspace'

const root = path.resolve(__dirname, '..')
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8')

describe('V33 one Role Brain and one Search Brain', () => {
  it('interprets a natural-language sourcing command into structured role state', () => {
    const brief = interpretRoleBrief('Find me a senior platform engineer in Minneapolis with Kubernetes and Terraform production experience.')
    expect(brief.mode).toBe('natural_language')
    expect(brief.intake.title.toLowerCase()).toContain('senior platform engineer')
    expect(brief.intake.location.toLowerCase()).toContain('minneapolis')
    expect(brief.intake.mustHaves.map(value => value.toLowerCase())).toEqual(expect.arrayContaining(['kubernetes', 'terraform']))
  })

  it('keeps uncertain preference language reviewable instead of silently making it a disqualifier', () => {
    const brief = interpretRoleBrief("Find me a senior platform engineer in Minneapolis with Kubernetes who probably isn't a pure people manager.")
    expect(brief.intake.disqualifiers).toEqual([])
    expect(brief.questions.some(question => /preference or exclusion language/i.test(question))).toBe(true)
  })

  it('uses the same canonical hypothesis IDs for role persistence and agentic execution', () => {
    const intake = parseRoleIntake('Senior Platform Engineer\nLocation: Minneapolis\nRequired: Kubernetes, Terraform, AWS')
    const projected = buildSearchLanes(intake)
    const canonical = buildCanonicalAgenticSearchPlan(intake)
    expect(projected.map(lane => lane.id)).toEqual(canonical.lanes.map(lane => lane.id))
    expect(projected[0]?.id).toBe('exact_title')
    expect(projected[0]?.status).toBe('approved')
    for (const oldId of ['database', 'network', 'resume-xray', 'web-xray']) {
      expect(projected.some(lane => lane.id === oldId)).toBe(false)
    }
  })

  it('projects canonical hypotheses with blind spots rather than source-centric pseudo-plans', () => {
    const intake = parseRoleIntake('Senior Platform Engineer\nRequired: Kubernetes, Terraform')
    const projected = buildSearchLanes(intake)
    expect(projected.length).toBeGreaterThanOrEqual(4)
    for (const lane of projected) {
      expect(lane.purpose).toContain('Blind spot:')
      expect(lane.query.trim().length).toBeGreaterThan(0)
    }
  })

  it('routes the live role page through canonical guided actions and V33 paste-back', () => {
    const page = read('app/app/roles/[id]/page.tsx')
    expect(page).toContain('RoleCanonicalSearchActions')
    expect(page).toContain('RolePasteBackV33')
    expect(page).not.toContain("from '@/components/RoleSearchActions'")
    expect(page).not.toContain('<RoleSearchActions roleId={id} />')
  })

  it('derives recruiter-run source queries from the canonical agentic plan', () => {
    const source = read('components/RoleCanonicalSearchActions.tsx')
    expect(source).toContain('buildCanonicalAgenticSearchPlan')
    expect(source).toContain("surface: 'linkedin_recruiter'")
    expect(source).toContain("surface: 'clearancejobs'")
    expect(source).toContain("surface: 'google_xray'")
    expect(source).not.toContain('jd-boolean-lanes')
    expect(source).not.toContain('calibrated-guided-search')
    expect(source).toContain('Guided · recruiter-run')
    expect(source).toContain('Approve hypothesis')
  })

  it('uses the existing O*NET transport in the live canonical planner without rewriting requirements', () => {
    const panel = read('components/RoleAgenticSearchPanel.tsx')
    expect(panel).toContain('/api/role-intelligence/onet?title=')
    expect(panel).toContain('buildCanonicalAgenticSearchPlan(role.intake, role.calibration, { onet })')
    const wizard = read('components/RoleIntakeWizardV33.tsx')
    expect(wizard).toContain('/api/role-intelligence/onet?title=')
    expect(wizard).toContain('enrichRoleIntakeWithOnet')
    expect(wizard).toContain('they do not rewrite your must-haves')
  })

  it('makes natural-language V33 intake the live role creation experience', () => {
    const portfolio = read('components/RoleWorkspaceClient.tsx')
    expect(portfolio).toContain('RoleIntakeWizardV33')
    expect(portfolio).toContain('Every search starts with one role brain')
    expect(portfolio).toContain('Describe the talent. Shape the search.')
    expect(portfolio).not.toContain('<RoleIntakeWizard ')
  })

  it('keeps recruiter-run paste-back provenance attached to the canonical lane and revision', () => {
    const pasteBack = read('components/RolePasteBackV33.tsx')
    expect(pasteBack).toContain('buildCanonicalAgenticSearchPlan')
    expect(pasteBack).toContain('laneLabel: lane.label')
    expect(pasteBack).toContain('planRevision: plan.revision')
    expect(pasteBack).toContain('Pasted text remains recruiter-provided evidence, not verified truth.')
  })
})
