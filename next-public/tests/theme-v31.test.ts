import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

function source(relative: string) {
  return readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8')
}

describe('V31 global theme system', () => {
  it('boots the stored theme before paint and supports light, dark, and system', () => {
    const layout = source('../app/layout.tsx')
    expect(layout).toContain("sourcingos.theme")
    expect(layout).toContain("prefers-color-scheme: dark")
    expect(layout).toContain("data-theme")
    expect(layout).toContain("./theme-v31.css")
    expect(layout).toContain('suppressHydrationWarning')
  })

  it('persists one theme preference across public and private surfaces', () => {
    const toggle = source('../components/ThemeToggle.tsx')
    expect(toggle).toContain("type ThemePreference = 'light' | 'dark' | 'system'")
    expect(toggle).toContain("localStorage.setItem(STORAGE_KEY")
    expect(toggle).toContain("matchMedia('(prefers-color-scheme: dark)')")
    expect(toggle).toContain("dataset.theme = resolved")
  })

  it('exposes the same control in the public navigation and app shell', () => {
    const nav = source('../components/Nav.tsx')
    const shell = source('../components/AppShell.tsx')
    expect(nav).toContain('<ThemeToggle />')
    expect(shell).toContain('<ThemeToggle />')
    expect(shell).toContain('<ThemeToggle compact />')
  })

  it('defines explicit public and authenticated light/dark palettes', () => {
    const css = source('../app/theme-v31.css')
    expect(css).toContain("html[data-theme='light'] body:not(:has(.app-shell))")
    expect(css).toContain("html[data-theme='dark'] body:not(:has(.app-shell))")
    expect(css).toContain("html[data-theme='light'] .app-shell")
    expect(css).toContain("html[data-theme='dark']")
    expect(css).toContain('--public-paper:#eef3f8')
    expect(css).toContain('--line:#cdd8e5')
  })
})
