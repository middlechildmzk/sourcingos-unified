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
  it('turns a recruiter sentence into a real read-only people search plan', async () => {
    const plan = await planConversationalSourcingTurnV36_15({
      message: 'Find 25 backend engineers in Minneapolis, MN with AWS and Kubernetes',
    })

    expect(plan.action).toBe('search_people')
    expect(plan.readOnly).toBe(true)
    expect(plan.criteria.limit).toBe(25)
    expect(plan.criteria.titles.some(title => /backend engineer/i.test(title))).toBe(true)
    expect(plan.criteria.skills).toEqual(expect.arrayContaining(['AWS', 'Kubernetes']))
    expect(plan.criteria.locations).toContain('Minneapolis, MN')
    expect(plan.toolPlan).toEqual(expect.arrayContaining([
      expect.objectContaining({ tool: 'search_people', executableNow: true, approvalRequired: false, costClass: 'breadth' }),
    ]))
    expect(plan.model.used).toBe(false)
  })

  it('keeps prior search context while applying conversational location refinement', async () => {
    const first = await planConversationalSourcingTurnV36_15({
      message: 'Find backend engineers in Minneapolis, MN with AWS and Kubernetes',
    })
    const refined = await planConversationalSourcingTurnV36_15({
      message: 'Prioritize production Kubernetes and move closer to St. Paul, MN',
      previousPlan: first,
    })

    expect(refined.action).toBe('search_people')
    expect(refined.criteria.titles.some(title => /backend engineer/i.test(title))).toBe(true)
    expect(refined.criteria.skills).toEqual(expect.arrayContaining(['AWS', 'Kubernetes']))
    expect(refined.criteria.locations).toEqual(['St. Paul, MN'])
    expect(refined.providerRequest.query).toContain('Recruiter refinement')
  })

  it('recognizes contact enrichment but refuses to auto-execute it', async () => {
    const first = await planConversationalSourcingTurnV36_15({
      message: 'Find backend engineers in Minneapolis, MN with Kubernetes',
    })
    const next = await planConversationalSourcingTurnV36_15({
      message: 'Find contact info for these people',
      previousPlan: first,
    })

    expect(next.action).toBe('approval_required')
    expect(next.toolPlan).toEqual(expect.arrayContaining([
      expect.objectContaining({ tool: 'find_contacts', approvalRequired: true, executableNow: false, costClass: 'paid_enrichment' }),
    ]))
    expect(next.warnings.join(' ')).toMatch(/will not auto-execute/i)
  })
})
