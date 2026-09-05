import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

const root = path.join(process.cwd())
const source = (file: string) => fs.readFileSync(path.join(root, file), 'utf8')

describe('V37 canonical sourcing entry points', () => {
  it('keeps the public product entry routed through the shared nav model', () => {
    const nav = source('data/nav.ts')
    expect(nav).toContain("{ label: 'Product', href: '/agentic-sourcing' }")
  })

  it('promotes one authenticated People Search workflow instead of competing sourcing destinations', () => {
    const shell = source('components/AppShell.tsx')
    expect(shell).toContain("{ href: '/app/search', label: 'People Search'")
    expect(shell).toContain("{ href: '/app/candidate-database', label: 'Talent'")
    expect(shell).toContain("{ href: '/app/sources', label: 'Sources'")
    expect(shell).not.toContain("label: 'AI Sourcing'")
    expect(shell).not.toContain("label: 'Talent Insights'")
  })

  it('keeps the canonical People Search, Talent, and Sources workflows directly available in the global command palette', () => {
    const palette = source('components/CommandPalette.tsx')
    expect(palette).toContain("href: '/app/search'")
    expect(palette).toContain("href: '/app/candidate-database'")
    expect(palette).toContain("href: '/app/sources'")
    expect(palette).toContain("label: 'People Search'")
  })

  it('does not teach Search Lab or AutoSource as primary navigation concepts', () => {
    const shell = source('components/AppShell.tsx')
    expect(shell).not.toContain("label: 'Search Lab'")
    expect(shell).not.toContain("label: 'AutoSource'")
    expect(shell).toContain("pathname === '/app/candidate-search'")
    expect(shell).toContain("pathname === '/app/acquisition'")
  })
})
