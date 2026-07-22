'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
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
  { href: '/app/today', label: 'Today', icon: 'today', description: 'Your prioritized decision inbox' },
  { href: '/app/roles', label: 'Roles', icon: 'roles', description: 'Searches, strategy, and pipelines' },
  { href: '/app/autosource', label: 'AutoSource', icon: 'autosource', description: 'Discovery campaigns and review' },
  { href: '/app/candidate-database', label: 'Candidates', icon: 'candidates', description: 'Identity, evidence, and rediscovery' },
]

const tools: NavigationItem[] = [
  { href: '/app/agent-os', label: 'Agent OS', icon: 'today', description: 'Agent runs and approvals' },
  { href: '/app/import', label: 'Import Center', icon: 'import', description: 'Bring in candidate data' },
  { href: '/app/candidate-search', label: 'Candidate Search', icon: 'search', description: 'Search across known records' },
  { href: '/app/acquisition', label: 'Acquisition & Sources', icon: 'acquisition', description: 'Source operations' },
  { href: '/app/evidence-ledger', label: 'Evidence Ledger', icon: 'ledger', description: 'Claim provenance and review' },
  { href: '/app/network', label: 'Network Vault', icon: 'network', description: 'Relationships and warm paths' },
  { href: '/sources', label: 'Source Toolkit', icon: 'toolkit', description: 'Open sourcing utilities' },
]

function active(pathname: string, href: string) {
  return pathname === href || (href !== '/app/agent-os' && pathname.startsWith(`${href}/`))
}

function hasActiveTool(pathname: string): boolean {
  return tools.some(item => active(pathname, item.href))
}

export function AppShell({ children, mode, authenticated, email, role }: AppShellProps) {
  const pathname = usePathname()
  const [toolsOpen, setToolsOpen] = useState(() => hasActiveTool(pathname))
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    if (hasActiveTool(pathname)) setToolsOpen(true)
  }, [pathname])

  return <div className="app-shell">
    <aside className={`app-sidebar ${mobileOpen ? 'app-sidebar-open' : ''}`}>
      <div className="app-brand-row">
        <Link href="/app/today" className="app-brand-mark"><span>S</span><div><b>SourcingOS</b><small>Recruiter intelligence</small></div></Link>
        <button className="app-sidebar-close" onClick={() => setMobileOpen(false)} aria-label="Close navigation">×</button>
      </div>

      <div className="app-workspace-label">Recruiting workspace</div>
      <CommandPalette />
      <nav className="app-primary-nav" aria-label="Primary workspace navigation">
        {primary.map(item => <Link key={item.href} href={item.href} onClick={() => setMobileOpen(false)} className={`app-nav-item ${active(pathname, item.href) ? 'active' : ''}`}>
          <span className="app-nav-icon"><ProductIcon name={item.icon} /></span>
          <span><b>{item.label}</b><small>{item.description}</small></span>
        </Link>)}
      </nav>

      <div className="app-sidebar-divider" />
      <button className="app-tools-toggle" onClick={() => setToolsOpen(value => !value)} aria-expanded={toolsOpen}>
        <span>Tools & data</span><span>{toolsOpen ? '−' : '+'}</span>
      </button>
      {toolsOpen && <nav className="app-secondary-nav" aria-label="Secondary tools">
        {tools.map(item => <Link key={item.href} href={item.href} title={item.description} onClick={() => setMobileOpen(false)} className={active(pathname, item.href) ? 'active' : ''}>
          <ProductIcon name={item.icon} /><span>{item.label}</span>
        </Link>)}
      </nav>}

      <div className="app-sidebar-spacer" />
      <div className="app-account-card">
        <div className="app-account-avatar">{email?.slice(0, 1).toUpperCase() || 'S'}</div>
        <div className="app-account-copy"><b>{email || (mode === 'preview' ? 'Preview workspace' : 'SourcingOS')}</b><small>{role === 'admin' ? 'Administrator' : mode === 'preview' ? 'Local preview' : 'Recruiter'}</small></div>
        {authenticated ? <LogoutButton compact /> : <Link href="/login" className="app-signin-link">Sign in</Link>}
      </div>
    </aside>

    {mobileOpen && <button className="app-shell-backdrop" aria-label="Close navigation" onClick={() => setMobileOpen(false)} />}

    <div className="app-main-column">
      <header className="app-mobile-header">
        <button className="app-mobile-menu" onClick={() => setMobileOpen(true)} aria-label="Open navigation">☰</button>
        <Link href="/app/today" className="app-mobile-brand">SourcingOS</Link>
        <CommandPalette triggerClassName="app-command-trigger app-command-trigger-mobile" hotkey={false} />
        <span className={mode === 'preview' ? 'app-mode-dot preview' : 'app-mode-dot'} title={mode === 'preview' ? 'Preview mode' : 'Connected'} />
      </header>
      {mode === 'preview' && <div className="app-preview-strip"><b>Preview mode</b><span>Durable agent execution and shared candidate data are unavailable until authenticated storage is connected.</span></div>}
      <main className="app-main-content">{children}</main>
    </div>
  </div>
}
