import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

const root = path.join(process.cwd())
const source = (file: string) => fs.readFileSync(path.join(root, file), 'utf8')

describe('V36.11 flagship sourcing entry points', () => {
  it('keeps the public navigation entry to agentic sourcing through the shared nav model', () => {
    const nav = source('data/nav.ts')
    expect(nav).toContain("{ label: 'Agentic Sourcing', href: '/agentic-sourcing' }")
  })

  it('promotes People Search, AI Sourcing, and Talent Insights in the authenticated primary workspace', () => {
    const shell = source('components/AppShell.tsx')
    expect(shell).toContain("href: '/app/people-search'")
    expect(shell).toContain("label: 'People Search'")
    expect(shell).toContain("href: '/app/agentic-sourcing'")
    expect(shell).toContain("label: 'AI Sourcing'")
    expect(shell).toContain("href: '/app/talent-insights'")
    expect(shell).toContain("label: 'Talent Insights'")
  })

  it('keeps all three flagship recruiter workflows directly available in the global command palette', () => {
    const palette = source('components/CommandPalette.tsx')
    expect(palette).toContain("href: '/app/people-search'")
    expect(palette).toContain("href: '/app/agentic-sourcing'")
    expect(palette).toContain("href: '/app/talent-insights'")
  })

  it('keeps raw Search Lab as a secondary research-and-data surface rather than the flagship people-search entry', () => {
    const shell = source('components/AppShell.tsx')
    expect(shell).toContain("href: '/app/candidate-search', label: 'Search Lab'")
    expect(shell.indexOf("const tools: NavigationItem[]")).toBeGreaterThan(shell.indexOf("const primary: NavigationItem[]"))
  })
})
