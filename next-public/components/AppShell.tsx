'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { LogoutButton } from '@/components/LogoutButton'
import { CommandPalette } from '@/components/CommandPalette'
import { ProductIcon, type ProductIconName } from '@/components/ProductIcon'
import { ThemeToggle } from '@/components/ThemeToggle'

type AppShellProps = {
  children: React.ReactNode
  mode: 'preview' | 'supabase'
  authenticated: boolean
  email?: string | null
  role?: string | null
}

type NavigationItem = {
  href: string
  label: string
  icon: ProductIconName
  description: string
}

const primary: NavigationItem[] = [
  { href: '/app/today', label: 'Today', icon: 'today', description: 'Your recruiting work now' },
  { href: '/app/roles', label: 'Roles', icon: 'roles', description: 'Search, slate, calibration' },
  { href: '/app/search', label: 'Search', icon: 'search', description: 'Find and refine talent' },
  { href: '/app/candidate-database', label: 'Talent', icon: 'candidates', description: 'People you know and can rediscover' },
  { href: '/app/sources', label: 'Sources', icon: 'toolkit', description: 'Connections, provenance, evidence' },
]

function active(pathname: string, href: string) {
  if (href === '/app/roles') return pathname === href || pathname.startsWith('/app/roles/') || pathname.startsWith('/app/agentic-sourcing/')
  if (href === '/app/search') return pathname === href || pathname.startsWith('/app/search/') || pathname === '/app/people-search' || pathname === '/app/agentic-sourcing' || pathname === '/app/candidate-search'
  if (href === '/app/candidate-database') return pathname === href || pathname.startsWith(`${href}/`) || pathname === '/app/network' || pathname === '/app/evidence-ledger'
  if (href === '/app/sources') return pathname === href || pathname.startsWith(`${href}/`) || pathname === '/sources' || pathname === '/app/import' || pathname === '/app/acquisition'
  return pathname === href || pathname.startsWith(`${href}/`)
}

function workspaceTitle(pathname: string): string {
  if (pathname.startsWith('/app/roles/')) return 'Role workspace'
  return primary.find(entry => active(pathname, entry.href))?.label || 'Recruiting workspace'
}

export function AppShell({ children, mode, authenticated, email, role }: AppShellProps) {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)
  const pageTitle = useMemo(() => workspaceTitle(pathname), [pathname])

  useEffect(() => { setMobileOpen(false) }, [pathname])

  return <div className="app-shell v37-shell">
    <aside className={`app-sidebar ${mobileOpen ? 'app-sidebar-open' : ''}`}>
      <div className="app-brand-row">
        <Link href="/app/today" className="app-brand-mark" aria-label="SourcingOS home">
          <span>S</span>
          <div><b>SourcingOS</b><small>Recruiter workbench</small></div>
        </Link>
        <button className="app-sidebar-close" onClick={() => setMobileOpen(false)} aria-label="Close navigation">×</button>
      </div>

      <Link href="/app/roles?new=1" className="app-new-role-button">
        <span className="app-new-role-plus">+</span>
        <span><b>New role</b><small>Start from a hiring need</small></span>
      </Link>

      <nav className="app-primary-nav v37-primary-nav" aria-label="Primary workspace navigation">
        {primary.map(item => <Link key={item.href} href={item.href} className={`app-nav-item ${active(pathname, item.href) ? 'active' : ''}`} title={item.description}>
          <span className="app-nav-icon"><ProductIcon name={item.icon} /></span>
          <span><b>{item.label}</b><small>{item.description}</small></span>
        </Link>)}
      </nav>

      <div className="app-sidebar-spacer" />
      <div className="app-trust-note">
        <span className="app-trust-dot" />
        <span>Evidence visible. Decisions stay human.</span>
      </div>
      <div className="app-account-card">
        <div className="app-account-avatar">{email?.slice(0, 1).toUpperCase() || 'S'}</div>
        <div className="app-account-copy"><b>{email || (mode === 'preview' ? 'Preview workspace' : 'SourcingOS')}</b><small>{role === 'admin' ? 'Administrator' : mode === 'preview' ? 'Local preview' : 'Recruiter'}</small></div>
        {authenticated ? <LogoutButton compact /> : <Link href="/login" className="app-signin-link">Sign in</Link>}
      </div>
    </aside>

    {mobileOpen && <button className="app-shell-backdrop" aria-label="Close navigation" onClick={() => setMobileOpen(false)} />}

    <div className="app-main-column">
      <header className="app-desktop-topbar">
        <div className="app-context-title"><span>Workspace</span><b>{pageTitle}</b></div>
        <div className="app-topbar-actions">
          <CommandPalette triggerClassName="app-command-trigger app-command-trigger-topbar" />
          <ThemeToggle />
          <Link className="btn app-topbar-new-role" href="/app/roles?new=1">+ New role</Link>
          <span className={`app-connection-pill ${mode === 'preview' ? 'preview' : ''}`} title={mode === 'preview' ? 'Browser-local preview workspace' : 'Connected account storage'}><span />{mode === 'preview' ? 'Local' : 'Connected'}</span>
        </div>
      </header>

      <header className="app-mobile-header">
        <button className="app-mobile-menu" onClick={() => setMobileOpen(true)} aria-label="Open navigation">☰</button>
        <Link href="/app/today" className="app-mobile-brand">SourcingOS</Link>
        <CommandPalette triggerClassName="app-command-trigger app-command-trigger-mobile" hotkey={false} />
        <ThemeToggle compact />
        <span className={mode === 'preview' ? 'app-mode-dot preview' : 'app-mode-dot'} title={mode === 'preview' ? 'Preview mode' : 'Connected'} />
      </header>
      {mode === 'preview' && <div className="app-preview-strip"><b>Preview mode</b><span>Role work stays on this browser until authenticated storage is connected.</span></div>}
      <main className="app-main-content">{children}</main>
    </div>
  </div>
}
