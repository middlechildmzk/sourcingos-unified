import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { getToolById, toolRecords } from '../lib/tool-directory'

function read(path: string) {
  return readFileSync(join(process.cwd(), path), 'utf8')
}

describe('tool directory authority layer', () => {
  it('adds OSINT as a first-class category', () => {
    const osint = toolRecords.filter(tool => tool.category === 'OSINT')
    expect(osint.length).toBeGreaterThanOrEqual(8)
    expect(getToolById('google-dorks')?.name).toContain('Google')
    expect(getToolById('wayback-machine')?.officialUrl).toContain('web.archive.org')
  })

  it('gives contact finders detail metadata and affiliate readiness', () => {
    for (const id of ['contactout', 'lusha', 'apollo', 'rocketreach']) {
      const tool = getToolById(id)
      expect(tool).toBeTruthy()
      expect(tool?.officialUrl).toMatch(/^https:\/\//)
      expect(['pending', 'direct', 'partner', 'not_configured']).toContain(tool?.affiliateStatus)
    }
  })

  it('makes directory cards navigable to tool pages', () => {
    const client = read('components/DirectoryClient.tsx')
    expect(client).toContain('href={toolHref(t)}')
    expect(client).toContain('Open tool page')
  })

  it('creates dynamic tool profile pages', () => {
    const page = read('app/directory/[id]/page.tsx')
    expect(page).toContain('generateStaticParams')
    expect(page).toContain('affiliateLabel')
    expect(page).toContain('Open official site')
    expect(page).toContain('SourcingOS checklist')
  })
})
