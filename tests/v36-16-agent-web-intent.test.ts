import { describe, expect, it } from 'vitest'
import { explicitWebResearchQueryV36_16, planConversationalSourcingTurnV36_16 } from '@/lib/agent-runtime-v36-16'

describe('V36.16 live-web conversational routing', () => {
  it('routes explicit web-research language to search_web', async () => {
    expect(explicitWebResearchQueryV36_16('Search the web for recent RHEL hiring at GDIT')).toBe('recent RHEL hiring at GDIT')
    const plan = await planConversationalSourcingTurnV36_16({ message: 'Search the web for recent RHEL hiring at GDIT' })
    expect(plan.version).toBe('v36.16')
    expect(plan.action).toBe('search_web')
    if (plan.action !== 'search_web') throw new Error('expected search_web')
    expect(plan.webRequest).toEqual({ action: 'search_web', query: 'recent RHEL hiring at GDIT' })
    expect(plan.toolPlan[0]).toEqual(expect.objectContaining({ tool: 'search_web', executableNow: true, approvalRequired: false, costClass: 'live' }))
    expect(plan.warnings.join(' ')).toMatch(/untrusted|candidate evidence/i)
  })

  it('does not silently turn normal candidate sourcing into live-web MCP calls', async () => {
    const message = 'Find 25 backend engineers in Minneapolis, MN with AWS + Kubernetes'
    expect(explicitWebResearchQueryV36_16(message)).toBeUndefined()
    const plan = await planConversationalSourcingTurnV36_16({ message })
    expect(plan.action).toBe('search_people')
    expect(plan.version).toBe('v36.15')
    expect(plan.toolPlan.some(tool => tool.tool === 'search_web')).toBe(false)
  })

  it('does not mistake generic look-for sourcing language for a web request', () => {
    expect(explicitWebResearchQueryV36_16('Look for senior technical sourcers in Washington, DC')).toBeUndefined()
    expect(explicitWebResearchQueryV36_16('Find people on the web with Kubernetes')).toBeUndefined()
    expect(explicitWebResearchQueryV36_16('Check the web for current hiring activity at Peraton')).toBe('current hiring activity at Peraton')
  })
})
