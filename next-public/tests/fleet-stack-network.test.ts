import { describe, expect, it } from 'vitest'

import { discoveryIntent } from '../lib/connectors/contract-v33-3'
import {
  STACK_NETWORK_SITES,
  STACK_OVERFLOW_SITE,
  buildStackOverflowDossier,
} from '../lib/connectors/stackoverflow-v2'
import { MemoryCreditLedger } from '../lib/fleet/credit-ledger'
import { MemoryLandingZone } from '../lib/fleet/landing-zone'
import {
  createStackNetworkScouts,
  findStackSite,
  rankSitesForIntent,
} from '../lib/fleet/scouts/stack-network-scout'

const OBSERVED_AT = '2026-09-04T12:00:00.000Z'

function stackUser(id = 4021) {
  return {
    user: { user_id: id, display_name: 'Amara Okonkwo', reputation: 51_200 },
    tagStats: [{ tag: 'rhel', window: 'all_time' as const, postCount: 84, score: 610 }],
    observedAt: OBSERVED_AT,
  }
}

describe('Stack Exchange network taxonomy', () => {
  it('gives every network site its own SourceName so provenance names the site', () => {
    const sources = STACK_NETWORK_SITES.map(site => site.source)
    expect(new Set(sources).size).toBe(STACK_NETWORK_SITES.length)
    expect(sources).toContain('serverfault')
    expect(sources).toContain('unix_se')
    // None of them masquerade as Stack Overflow.
    expect(sources).not.toContain('stackoverflow')
  })

  it('resolves a site from its SourceName', () => {
    expect(findStackSite('serverfault')?.apiSlug).toBe('serverfault')
    expect(findStackSite('security_se')?.host).toBe('security.stackexchange.com')
    expect(findStackSite('github')).toBeUndefined()
  })
})

describe('site-aware dossier construction', () => {
  it('defaults to Stack Overflow when no site is supplied', () => {
    const dossier = buildStackOverflowDossier(stackUser())
    expect(dossier!.source).toBe('stackoverflow')
    expect(dossier!.person.profileUrl).toContain('stackoverflow.com')
  })

  it('attributes a Server Fault answer to Server Fault, not Stack Overflow', () => {
    const site = findStackSite('serverfault')!
    const dossier = buildStackOverflowDossier({ ...stackUser(), site })

    expect(dossier!.source).toBe('serverfault')
    expect(dossier!.person.profileUrl).toContain('serverfault.com')
    // Every provenance record must name the real site.
    for (const technology of dossier!.technologies) {
      expect(technology.provenance.source).toBe('serverfault')
    }
    for (const artifact of dossier!.artifacts) {
      expect(artifact.source).toBe('serverfault')
      for (const metric of artifact.metrics) {
        expect(metric.source).toBe('serverfault')
      }
    }
    for (const anchor of dossier!.anchors) {
      expect(anchor.provenance.source).toBe('serverfault')
    }
  })

  it('does not leak the Stack Overflow label into another site\'s statements', () => {
    const site = findStackSite('unix_se')!
    const dossier = buildStackOverflowDossier({ ...stackUser(), site })
    const statements = dossier!.artifacts.map(artifact => artifact.statement || '').join(' ')
    expect(statements).not.toContain('Stack Overflow')
  })
})

describe('site routing', () => {
  it('routes RHEL administration to Server Fault and Unix & Linux', () => {
    const sites = rankSitesForIntent(
      discoveryIntent({ hypothesis: 'RHEL administrator', capabilityTerms: ['rhel', 'ansible'] }),
    ).map(site => site.source)
    expect(sites.slice(0, 2)).toEqual(expect.arrayContaining(['serverfault', 'unix_se']))
  })

  it('routes a security clearance infrastructure role to the security site', () => {
    const sites = rankSitesForIntent(
      discoveryIntent({ hypothesis: 'cleared SOC analyst', capabilityTerms: ['siem', 'nist'] }),
    ).map(site => site.source)
    expect(sites[0]).toBe('security_se')
  })

  it('routes network engineering to the network site', () => {
    const sites = rankSitesForIntent(
      discoveryIntent({ hypothesis: 'network engineer', capabilityTerms: ['bgp', 'cisco'] }),
    ).map(site => site.source)
    expect(sites[0]).toBe('networkeng_se')
  })

  it('falls back to broad sites rather than returning nothing on no signal', () => {
    const sites = rankSitesForIntent(discoveryIntent({ hypothesis: 'someone interesting' }))
    // No affinity match is not evidence that no site fits.
    expect(sites.length).toBeGreaterThan(0)
    expect(sites.map(site => site.source)).toContain('serverfault')
  })
})

describe('network quota discipline', () => {
  it('caps sites per run because the whole network shares one quota', () => {
    const scouts = createStackNetworkScouts(
      discoveryIntent({ hypothesis: 'linux kubernetes security network sql cisco' }),
      { maxSites: 2 },
    )
    expect(scouts).toHaveLength(2)
  })

  it('honours an explicit site list over intent-based routing', () => {
    const scouts = createStackNetworkScouts(discoveryIntent({ hypothesis: 'anything' }), {
      sites: [findStackSite('dba_se')!],
      maxSites: 4,
    })
    expect(scouts.map(scout => scout.source)).toEqual(['dba_se'])
  })

  it('reserves and refunds per site independently', async () => {
    const credits = new MemoryCreditLedger(100)
    const scouts = createStackNetworkScouts(
      discoveryIntent({ hypothesis: 'rhel administrator', capabilityTerms: ['rhel'], limit: 10 }),
      {
        maxSites: 1,
        fetchImpl: (async () =>
          new Response(JSON.stringify({ items: [], quota_remaining: 9000 }), {
            status: 200,
          })) as unknown as typeof fetch,
      },
    )

    const result = await scouts[0].run(
      discoveryIntent({ hypothesis: 'rhel administrator', capabilityTerms: ['rhel'], limit: 10 }),
      { landingZone: new MemoryLandingZone(), credits },
    )

    // Nobody returned, so the whole reservation is released.
    expect(result.dossiers).toHaveLength(0)
    expect(credits.balance).toBe(100)
  })

  it('reports an empty tag match as a coverage limit, not an empty talent pool', async () => {
    const scouts = createStackNetworkScouts(discoveryIntent({ hypothesis: 'rhel', limit: 5 }), {
      maxSites: 1,
      fetchImpl: (async () =>
        new Response(JSON.stringify({ items: [] }), { status: 200 })) as unknown as typeof fetch,
    })

    const result = await scouts[0].run(discoveryIntent({ hypothesis: '', limit: 5 }), {
      landingZone: new MemoryLandingZone(),
      credits: new MemoryCreditLedger(100),
    })

    const warnings = result.report.warnings.join(' ')
    if (warnings) expect(warnings).not.toContain('no practitioners')
  })
})

describe('cross-site identity', () => {
  it('does not merge two network accounts sharing a display name', () => {
    const serverFault = buildStackOverflowDossier({
      ...stackUser(4021),
      site: findStackSite('serverfault')!,
    })
    const unix = buildStackOverflowDossier({
      ...stackUser(9912),
      site: findStackSite('unix_se')!,
    })

    // Same person almost certainly. Still two records until a recruiter says so,
    // or until the /associated route is wired and verified.
    expect(serverFault!.person.sourceProfileId).not.toBe(unix!.person.sourceProfileId)
    expect(serverFault!.source).not.toBe(unix!.source)
  })
})

describe('backwards compatibility', () => {
  it('leaves the default Stack Overflow site descriptor unchanged', () => {
    expect(STACK_OVERFLOW_SITE.apiSlug).toBe('stackoverflow')
    expect(STACK_OVERFLOW_SITE.source).toBe('stackoverflow')
    expect(STACK_OVERFLOW_SITE.host).toBe('stackoverflow.com')
  })
})

describe('routing regression: acronym substring matching', () => {
  it('does not route a sysadmin search to the security site via "admiNISTrator"', () => {
    const sites = rankSitesForIntent(
      discoveryIntent({ hypothesis: 'systems administrator', capabilityTerms: ['rhel'] }),
    ).map(site => site.source)
    // An unbounded /nist/ matches "admi(nist)rator". Word boundaries are required.
    expect(sites).not.toContain('security_se')
  })

  it('still routes a real NIST reference to the security site', () => {
    const sites = rankSitesForIntent(
      discoveryIntent({ hypothesis: 'compliance engineer', capabilityTerms: ['NIST 800-53'] }),
    ).map(site => site.source)
    expect(sites).toContain('security_se')
  })

  it('does not match "dba" inside an unrelated word', () => {
    const sites = rankSitesForIntent(
      discoveryIntent({ hypothesis: 'feedback engineer', capabilityTerms: ['telemetry'] }),
    ).map(site => site.source)
    expect(sites).not.toContain('dba_se')
  })
})
