import { AdminAnalytics } from '@/components/AdminAnalytics'
export const metadata = { title: 'Admin Analytics', robots: { index: false, follow: false } }
export default function Page(){ return <main className="wrap"><h1>Admin Analytics</h1><p className="lead">Local preview analytics for public tool/page usage.</p><AdminAnalytics /></main> }
