import { redirect } from 'next/navigation'
import { AdminAnalytics } from '@/components/AdminAnalytics'
import { getSession } from '@/lib/supabase/session'

export const metadata = { title: 'Admin Analytics', robots: { index: false, follow: false } }

export default async function Page(){
  const session = await getSession()
  if (session.mode === 'preview') redirect('/login?from=/admin/analytics')
  if (!session.authenticated) redirect('/login?from=/admin/analytics')
  if (session.user.role !== 'admin') redirect('/app/candidate-search')
  return <main className="wrap"><h1>Admin Analytics</h1><p className="lead">Public tool/page usage for admin review.</p><AdminAnalytics /></main>
}
