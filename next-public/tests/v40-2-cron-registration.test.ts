import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(process.cwd())

function read(relative: string) {
  return fs.readFileSync(path.join(root, relative), 'utf8')
}

describe('V40.2 autonomous fleet cron registration', () => {
  it('targets the canonical trailing-slash route used by this Next app', () => {
    const config = JSON.parse(read('vercel.json')) as { crons?: Array<{ path: string; schedule: string }> }
    const nextConfig = read('next.config.mjs')

    expect(nextConfig).toContain('trailingSlash: true')
    expect(config.crons).toEqual([
      { path: '/api/cron/fleet/', schedule: '*/5 * * * *' },
    ])
  })

  it('keeps the fleet cron behind explicit cron authentication', () => {
    const route = read('app/api/cron/fleet/route.ts')
    expect(route).toContain('authorizeCronRequest(req)')
    expect(route).toContain("auth !== 'authorized'")
    expect(route).toContain('claimDueFleetLanesV40(sb, 4)')
  })
})
