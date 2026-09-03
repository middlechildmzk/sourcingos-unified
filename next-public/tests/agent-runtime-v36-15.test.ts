import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { planConversationalSourcingTurnV36_15 } from '../lib/agent-runtime-v36-15'

const envKeys = ['AI_PROVIDER', 'AI_PROVIDER_API_KEY', 'AI_PROVIDER_MODEL', 'ANTHROPIC_API_KEY', 'OPENAI_API_KEY'] as const
const saved = new Map<string, string | undefined>()

beforeEach(() => {
  for (const key of envKeys) {
    saved.set(key, process.env[key])
    delete process.env[key]
  }
})

afterEach(() => {
  for (const key of envKeys) {
    const value = saved.get(key)
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
  saved.clear()
})

describe('V36.15 conversational sourcing runtime', () => {
  it('keeps counted role, location, skills and company fields semantically separate', async () => {
    const plan = await planConversationalSourcingTurnV36_15({
      message: 'Find 25 backend engineers in Minneapolis, MN with AWS and Kubernetes',
    })

    expect(plan.action).toBe('search_people')
    expect(plan.readOnly).toBe(true)
    expect(plan.criteria.limit).toBe(25)
    expect(plan.criteria.titles).toContain('backend engineers')
    expect(plan.criteria.titles.every(title => !/Minneapolis|\b25\b/i.test(title))).toBe(true)
    expect(plan.criteria.skills).toEqual(expect.arrayContaining(['AWS', 'Kubernetes']))
    expect(plan.criteria.locations).toEqual(['Minneapolis, MN'])
    expect(plan.criteria.companies).toEqual([])
    expect(plan.criteria.requirements).toEqual(expect.arrayContaining([
      expect.objectContaining({ text: 'AWS', mustHave: true }),
      expect.objectContaining({ text: 'Kubernetes', mustHave: true }),
    ]))
    expect(plan.toolPlan).toEqual(expect.arrayContaining([
      expect.objectContaining({ tool: 'search_people', executableNow: true, approvalRequired: false, costClass: 'breadth' }),
    ]))
    expect(plan.model.used).toBe(false)
  })

  it('keeps prior search context while applying location and preference refinement', async () => {
    const first = await planConversationalSourcingTurnV36_15({
      message: 'Find backend engineers in Minneapolis, MN with AWS and Kubernetes',
    })
    const refined = await planConversationalSourcingTurnV36_15({
      message: 'Prioritize people with production Kubernetes experience and move closer to St. Paul, MN',
      previousPlan: first,
    })

    expect(refined.action).toBe('search_people')
    expect(refined.criteria.titles).toContain('backend engineers')
    expect(refined.criteria.skills).toEqual(expect.arrayContaining(['AWS', 'Kubernetes']))
    expect(refined.criteria.locations).toEqual(['St. Paul, MN'])
    expect(refined.criteria.companies).toEqual([])
    expect(refined.criteria.requirements).toEqual(expect.arrayContaining([
      expect.objectContaining({ text: expect.stringMatching(/^Preference:.*production Kubernetes experience/i), mustHave: false }),
    ]))
    expect(refined.providerRequest.query).toContain('Recruiter refinement')
  })

  it('turns top-N contact enrichment into an explicit approval-scoped paid read', async () => {
    const first = await planConversationalSourcingTurnV36_15({
      message: 'Find backend engineers in Minneapolis, MN with Kubernetes',
    })
    const next = await planConversationalSourcingTurnV36_15({
      message: 'Find contact info for the top 5',
      previousPlan: first,
    })

    expect(next.action).toBe('approval_required')
    expect(next.toolPlan).toEqual(expect.arrayContaining([
      expect.objectContaining({
        tool: 'find_contacts',
        targetCount: 5,
        approvalRequired: true,
        executableNow: false,
        costClass: 'paid_enrichment',
      }),
    ]))
    expect(next.assistantSummary).toMatch(/top 5/i)
    expect(next.warnings.join(' ')).toMatch(/until.*approve|until.*approval/i)
  })
})
