import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(process.cwd())

function read(relative: string) {
  return fs.readFileSync(path.join(root, relative), 'utf8')
}

describe('V40 autonomous fleet cron registration', () => {
  it('targets canonical trailing-slash routes used by this Next app', () => {
    const config = JSON.parse(read('vercel.json')) as { crons?: Array<{ path: string; schedule: string }> }
    const nextConfig = read('next.config.mjs')

    expect(nextConfig).toContain('trailingSlash: true')
    expect(config.crons).toContainEqual({ path: '/api/cron/fleet/', schedule: '*/30 * * * *' })
    expect(config.crons).toContainEqual({ path: '/api/cron/enrichment/', schedule: '*/15 * * * *' })
    expect(config.crons).toContainEqual({ path: '/api/cron/resume-sprint/', schedule: '*/3 * * * *' })
  })

  it('lets platform cron requests bypass public canonical-host redirects', () => {
    const proxy = read('proxy.ts')
    expect(proxy).toContain('isPlatformCronPath(pathname)')
    expect(proxy).toContain("clean === '/api/cron' || clean.startsWith('/api/cron/')")
    expect(proxy).toContain('request.nextUrl.host !== canonicalHost && !isPlatformCronPath(pathname)')
  })

  it('keeps discovery, enrichment, and Resume/CV sprint crons behind explicit cron authentication', () => {
    const discovery = read('app/api/cron/fleet/route.ts')
    const enrichment = read('app/api/cron/enrichment/route.ts')
    const sprint = read('app/api/cron/resume-sprint/route.ts')
    for (const route of [discovery, enrichment, sprint]) {
      expect(route).toContain('authorizeCronRequest(req)')
      expect(route).toContain("auth !== 'authorized'")
    }
    expect(discovery).toContain('claimDueFleetLanesV40(sb, 4)')
    expect(enrichment).toContain('runEnrichmentTickV40_4(sb)')
    expect(sprint).toContain('runResumeSprintTickV40_5(sb)')
  })
})
