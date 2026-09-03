import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

const root = path.join(process.cwd())
const source = (file: string) => fs.readFileSync(path.join(root, file), 'utf8')

describe('V31 sitewide agentic sourcing entry points', () => {
  it('keeps the public navigation entry to agentic sourcing', () => {
    const nav = source('components/Nav.tsx')
    expect(nav).toContain("href=\"/agentic-sourcing\"")
    expect(nav).toContain('Agentic Sourcing')
  })

  it('promotes AI Sourcing in the authenticated primary workspace', () => {
    const shell = source('components/AppShell.tsx')
    expect(shell).toContain("href: '/app/agentic-sourcing'")
    expect(shell).toContain("label: 'AI Sourcing'")
    expect(shell).toContain("icon: 'agentic'")
  })

  it('keeps a direct agentic-sourcing action in the global command palette', () => {
    const palette = source('components/CommandPalette.tsx')
    expect(palette).toContain("href: '/app/agentic-sourcing'")
    expect(palette).toMatch(/AI Sourcing|Agentic Sourcing/)
  })

  it('keeps role workspace sourcing controls routed to agentic sourcing', () => {
    const workspace = source('components/RoleWorkspacePage.tsx')
    expect(workspace).toContain('/app/agentic-sourcing')
  })
})
