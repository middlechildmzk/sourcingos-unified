'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { LogoutButton } from '@/components/LogoutButton'
import { CommandPalette } from '@/components/CommandPalette'
import { ProductIcon, type ProductIconName } from '@/components/ProductIcon'

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
  { href: '/app/today', label: 'Today', icon: 'today', description: 'What needs your judgment now' },
  { href: '/app/roles', label: 'Roles', icon: 'roles', description: 'Search strategy, slate, calibration' },
  { href: '/app/candidate-database', label: 'Talent', icon: 'candidates', description: 'People, evidence, rediscovery' },
  { href: '/app/agent-os', label: 'Ask SourcingOS', icon: 'autosource', description: 'Research and sourcing guidance' },
]

const tools: NavigationItem[] = [
  { href: '/app/candidate-search', label: 'Search Lab', icon: 'search', description: 'Run supported source searches' },
  { href: '/app/autosource', label: 'AutoSource', icon: 'autosource', description: 'Continuous discovery for active roles' },
  { href: '/app/import', label: 'Import Center', icon: 'import', description: 'Bring authorized candidate data in' },
  { href: '/app/evidence-ledger', label: 'Evidence Ledger', icon: 'ledger', description: 'Claim provenance and review' },
  { href: '/app/network', label: 'Network Vault', icon: 'network', description: 'Relationships and warm paths' },
  { href: '/app/acquisition', label: 'Source Operations', icon: 'acquisition', description: 'Connector and acquisition controls' },
  { href: '/sources', label: 'Source Toolkit', icon: 'toolkit', description: 'Open sourcing utilities' },
]

function active(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`)
}

function hasActiveTool(pathname: string): boolean {
  return tools.some(item => active(pathname, item.href))
}

function workspaceTitle(pathname: string): string {
  if (pathname.startsWith('/app/roles/')) return 'Role workspace'
  const item = [...primary, ...tools].find(entry => active(pathname, entry.href))
  return item?.label || 'Recruiting workspace'
}

export function AppShell({ children, mode, authenticated, email, role }: AppShellProps) {
  const pathname = usePathname()
  const [toolsOpen, setToolsOpen] = useState(() => hasActiveTool(pathname))
  const [mobileOpen, setMobileOpen] = useState(false)
  const pageTitle = useMemo(() => workspaceTitle(pathname), [pathname])

  useEffect(() => {
    if (hasActiveTool(pathname)) setToolsOpen(true)
    setMobileOpen(false)
  }, [pathname])

  return <div className="app-shell app-shell-v30">
    <aside className={`app-sidebar ${mobileOpen ? 'app-sidebar-open' : ''}`}>
      <div className="app-brand-row">
        <Link href="/app/today" className="app-brand-mark" aria-label="SourcingOS home">
          <span>S</span>
          <div><b>SourcingOS</b><small>Evidence-first sourcing</small></div>
        </Link>
        <button className="app-sidebar-close" onClick={() => setMobileOpen(false)} aria-label="Close navigation">×</button>
      </div>

      <Link href="/app/roles?new=1" className="app-new-role-button">
        <span className="app-new-role-plus">+</span>
        <span><b>New role</b><small>Paste a JD or start from intake</small></span>
      </Link>

      <div className="app-workspace-label">Workspace</div>
      <nav className="app-primary-nav" aria-label="Primary workspace navigation">
        {primary.map(item => <Link key={item.href} href={item.href} className={`app-nav-item ${active(pathname, item.href) ? 'active' : ''}`}>
          <span className="app-nav-icon"><ProductIcon name={item.icon} /></span>
          <span><b>{item.label}</b><small>{item.description}</small></span>
        </Link>)}
      </nav>

      <div className="app-sidebar-divider" />
      <button className="app-tools-toggle" onClick={() => setToolsOpen(value => !value)} aria-expanded={toolsOpen}>
        <span>Research & data</span><span className="app-tools-chevron">{toolsOpen ? '−' : '+'}</span>
      </button>
      {toolsOpen && <nav className="app-secondary-nav" aria-label="Research and data tools">
        {tools.map(item => <Link key={item.href} href={item.href} title={item.description} className={active(pathname, item.href) ? 'active' : ''}>
          <ProductIcon name={item.icon} /><span>{item.label}</span>
        </Link>)}
      </nav>}

      <div className="app-sidebar-spacer" />
      <div className="app-trust-note">
        <span className="app-trust-dot" />
        <span>Human approval stays in the loop.</span>
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
        <div className="app-context-title">
          <span>SourcingOS</span>
          <b>{pageTitle}</b>
        </div>
        <div className="app-topbar-actions">
          <CommandPalette triggerClassName="app-command-trigger app-command-trigger-topbar" />
          <Link className="btn app-topbar-new-role" href="/app/roles?new=1">+ New role</Link>
          <span className={`app-connection-pill ${mode === 'preview' ? 'preview' : ''}`} title={mode === 'preview' ? 'Browser-local preview workspace' : 'Connected account storage'}>
            <span />{mode === 'preview' ? 'Local' : 'Connected'}
          </span>
        </div>
      </header>

      <header className="app-mobile-header">
        <button className="app-mobile-menu" onClick={() => setMobileOpen(true)} aria-label="Open navigation">☰</button>
        <Link href="/app/today" className="app-mobile-brand">SourcingOS</Link>
        <CommandPalette triggerClassName="app-command-trigger app-command-trigger-mobile" hotkey={false} />
        <span className={mode === 'preview' ? 'app-mode-dot preview' : 'app-mode-dot'} title={mode === 'preview' ? 'Preview mode' : 'Connected'} />
      </header>
      {mode === 'preview' && <div className="app-preview-strip"><b>Preview mode</b><span>Role work stays on this browser until authenticated storage is connected.</span></div>}
      <main className="app-main-content">{children}</main>
    </div>
  </div>
}
