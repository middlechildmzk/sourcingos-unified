import { getSession } from '@/lib/supabase/session'
import { AppShell } from '@/components/AppShell'
import type { Metadata } from 'next'
import './app-shell.css'
import './v25-2.css'
import './import-center.css'

export const metadata: Metadata = { robots: { index: false, follow: false } }

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession()
  return <AppShell
    mode={session.mode}
    authenticated={session.authenticated}
    email={session.user?.email}
    role={session.user?.role}
  >
    {children}
  </AppShell>
}
