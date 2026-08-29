import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

function source(path: string): string {
  return readFileSync(resolve(process.cwd(), path), 'utf8')
}

describe('V31 sitewide public design and Agentic Sourcing entry', () => {
  it('promotes Agentic Sourcing in public navigation', () => {
    const nav = source('data/nav.ts')
    expect(nav).toContain("{ label: 'Agentic Sourcing', href: '/agentic-sourcing' }")
    expect(nav).toContain("{ label: 'Agentic Sourcing', href: '/app/agentic-sourcing' }")
  })

  it('promotes Agentic Sourcing in the authenticated primary workspace', () => {
    const shell = source('components/AppShell.tsx')
    expect(shell).toContain("href: '/app/agentic-sourcing'")
    expect(shell).toContain("label: 'Agentic Sourcing'")
    expect(shell).toContain("icon: 'agentic'")
  })

  it('provides a dedicated role-aware agentic hub and role execution route', () => {
    const hub = source('components/AgenticSourcingHub.tsx')
    const page = source('app/app/agentic-sourcing/page.tsx')
    const rolePage = source('app/app/agentic-sourcing/[id]/page.tsx')
    expect(page).toContain('AgenticSourcingHub')
    expect(hub).toContain('Plan, run, review, and learn by role.')
    expect(hub).toContain('/app/agentic-sourcing/${encodeURIComponent(role.id)}')
    expect(rolePage).toContain('RoleAgenticSearchPanel')
    expect(rolePage).toContain('RoleSearchActions')
  })

  it('keeps public visual restyling out of the authenticated app shell', () => {
    const css = source('app/public-v31.css')
    const layout = source('app/layout.tsx')
    expect(layout).toContain("import './public-v31.css'")
    expect(css).toContain('body:not(:has(.app-shell))')
    expect(css).toContain('body:has(.app-shell) > .nav')
    expect(css).toContain('body:has(.app-shell) > .footer')
  })

  it('publishes an honest public Agentic Sourcing product page', () => {
    const page = source('app/agentic-sourcing/page.tsx')
    expect(page).toContain('An agent that can <em>source</em> without pretending.')
    expect(page).toContain('Read-only public research')
    expect(page).toContain('No autonomous rejection or outreach.')
    expect(page).toContain('No fake source execution.')
  })
})
