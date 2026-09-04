import { getSession } from '@/lib/supabase/session'
import { AppShell } from '@/components/AppShell'
import { ClientErrorReporter } from '@/components/ClientErrorReporter'
import type { Metadata } from 'next'
import './app-shell.css'
import './v25-2.css'
import './v26.css'
import './v26-candidate-review.css'
import './import-center.css'
import './v30-uiux.css'
import './tokens.css'
import './product-surface.css'
import './search-workspace.css'
import './search-v37-polish.css'
import './role-workspace-v37.css'
import './today-v37.css'
import './talent-v37.css'
import './sources-v37.css'
import './roles-v37.css'
import './mobile-v37.css'
/* Canonical V37.1 presentation layer. Legacy files above remain fallback-only for non-canonical/advanced routes. */
import './visual-system-v37-1.css'

export const metadata: Metadata = { robots: { index: false, follow: false } }

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession()
  return <AppShell
    mode={session.mode}
    authenticated={session.authenticated}
    email={session.user?.email}
    role={session.user?.role}
  >
    <ClientErrorReporter />
    {children}
  </AppShell>
}
