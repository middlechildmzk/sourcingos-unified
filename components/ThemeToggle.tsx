'use client'

import { useEffect, useState } from 'react'

export type ThemePreference = 'light' | 'dark' | 'system'

const STORAGE_KEY = 'sourcingos.theme'

function validPreference(value: string | null): value is ThemePreference {
  return value === 'light' || value === 'dark' || value === 'system'
}

function resolvedTheme(preference: ThemePreference): 'light' | 'dark' {
  if (preference !== 'system') return preference
  if (typeof window === 'undefined') return 'light'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function applyTheme(preference: ThemePreference) {
  const resolved = resolvedTheme(preference)
  document.documentElement.dataset.themePreference = preference
  document.documentElement.dataset.theme = resolved
  document.documentElement.style.colorScheme = resolved
}

export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const [preference, setPreference] = useState<ThemePreference>('system')

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    const next = validPreference(stored) ? stored : 'system'
    setPreference(next)
    applyTheme(next)

    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const handleSystemChange = () => {
      const current = window.localStorage.getItem(STORAGE_KEY)
      if (!validPreference(current) || current === 'system') applyTheme('system')
    }
    media.addEventListener('change', handleSystemChange)
    return () => media.removeEventListener('change', handleSystemChange)
  }, [])

  function choose(next: ThemePreference) {
    setPreference(next)
    window.localStorage.setItem(STORAGE_KEY, next)
    applyTheme(next)
  }

  return <div className={`theme-toggle ${compact ? 'theme-toggle-compact' : ''}`} role="group" aria-label="Color theme">
    <button type="button" className={preference === 'light' ? 'active' : ''} aria-pressed={preference === 'light'} onClick={() => choose('light')} title="Use light theme">
      <span aria-hidden="true">☀</span><span className="theme-toggle-label">Light</span>
    </button>
    <button type="button" className={preference === 'dark' ? 'active' : ''} aria-pressed={preference === 'dark'} onClick={() => choose('dark')} title="Use dark theme">
      <span aria-hidden="true">◐</span><span className="theme-toggle-label">Dark</span>
    </button>
    <button type="button" className={preference === 'system' ? 'active' : ''} aria-pressed={preference === 'system'} onClick={() => choose('system')} title="Follow system appearance">
      <span aria-hidden="true">◌</span><span className="theme-toggle-label">System</span>
    </button>
  </div>
}
