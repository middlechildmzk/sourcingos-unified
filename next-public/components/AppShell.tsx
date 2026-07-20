'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { LogoutButton } from '@/components/LogoutButton'
import { CommandPalette } from '@/components/CommandPalette'

type AppShellProps = {
  children: React.ReactNode
  mode: 'preview' | 'supabase'
  authenticated: boolean
  email?: string | null
  role?: string | null
}

const primary = [
  { href: '/app/agent-os', label: 'Today', icon: '✦', description: 'Approvals and agent work' },
  { href: '/app/roles', label: 'Roles', icon: '▣', description: 'Active searches and pipelines' },
  { href: '/app/autosource', label: 'AutoSource', icon: '◎', description: 'Campaigns and candidate review' },
  { href: '/app/candidate-database', label: 'Candidates', icon: '◉', description: 'Candidate intelligence graph' },
]

const tools = [
  { href: '/app/import', label: 'Import Center' },
  { href: '/app/candidate-search', label: 'Candidate Search' },
  { href: '/app/acquisition', label: 'Acquisition & Sources' },
  { href: '/app/evidence-ledger', label: 'Evidence Ledger' },
  { href: '/app/network', label: 'Network Vault' },
  { href: '/sources', label: 'Source Toolkit' },
]

function active(pathname: string, href: string) {
  return pathname === href || (href !== '/app/agent-os' && pathname.startsWith(`${href}/`))
}

export function AppShell({ children, mode, authenticated, email, role }: AppShellProps) {
  const pathname = usePathname()
  const [toolsOpen, setToolsOpen] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  return <div className="app-shell">
    <aside className={`app-sidebar ${mobileOpen ? 'app-sidebar-open' : ''}`}>
      <div className="app-brand-row">
        <Link href="/app/agent-os" className="app-brand-mark"><span>S</span><b>SourcingOS</b></Link>
        <button className="app-sidebar-close" onClick={() => setMobileOpen(false)} aria-label="Close navigation">×</button>
      </div>

      <div className="app-workspace-label">Recruiting workspace</div>
      <CommandPalette />
      <nav className="app-primary-nav" aria-label="Primary workspace navigation">
        {primary.map(item => <Link key={item.href} href={item.href} onClick={() => setMobileOpen(false)} className={`app-nav-item ${active(pathname, item.href) ? 'active' : ''}`}>
          <span className="app-nav-icon">{item.icon}</span>
          <span><b>{item.label}</b><small>{item.description}</small></span>
        </Link>)}
      </nav>

      <div className="app-sidebar-divider" />
      <button className="app-tools-toggle" onClick={() => setToolsOpen(value => !value)} aria-expanded={toolsOpen}>
        <span>Tools & data</span><span>{toolsOpen ? '−' : '+'}</span>
      </button>
      {toolsOpen && <nav className="app-secondary-nav" aria-label="Secondary tools">
        {tools.map(item => <Link key={item.href} href={item.href} onClick={() => setMobileOpen(false)} className={active(pathname, item.href) ? 'active' : ''}>{item.label}</Link>)}
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
        <Link href="/app/agent-os" className="app-mobile-brand">SourcingOS</Link>
        <CommandPalette triggerClassName="app-command-trigger app-command-trigger-mobile" hotkey={false} />
        <span className={mode === 'preview' ? 'app-mode-dot preview' : 'app-mode-dot'} title={mode === 'preview' ? 'Preview mode' : 'Connected'} />
      </header>
      {mode === 'preview' && <div className="app-preview-strip"><b>Preview mode</b><span>Durable agent execution and shared candidate data are unavailable until authenticated storage is connected.</span></div>}
      <main className="app-main-content">{children}</main>
    </div>
  </div>
}
